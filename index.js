var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
/// <reference path="./type_declarations/index.d.ts" />
var stream = require('stream');
var yargs = require('yargs');
var types = require('./types');
/**
Splitter is a stream.Transform that rechunks a stream into sub-buffers.
The output (readable) part is set to objectMode true, and emits Buffer objects.
The input (writable) part should be plain buffers (have no encoding).

By default, it splits on the universal newline (\r, \r\n, or \n).
The split byte can be specified in the options.

_writableState.decodeStrings defaults to true, so we should get Buffers
regardless of what's pushed in. If `opts.decodeStrings` is set to `false`,
the behavior is undefined. (TODO: force decodeStrings: true maybe?)

In other words, the Splitter should have the following values:

    {
      _writableState: {
        decodeStrings: true,
        objectMode: false
      },
      _readableState: {
        objectMode: true
      }
    }

*/
var Splitter = (function (_super) {
    __extends(Splitter, _super);
    function Splitter(opts) {
        if (opts === void 0) { opts = {}; }
        _super.call(this, opts);
        this._buffer = new Buffer(0);
        this._split_byte = null; // null indicates smart handling of \r and \n characters
        // if we are given a split string, use the byte code of the first character to split
        if (opts.split_string !== undefined) {
            // throws if opts.split_string is not a string
            this._split_byte = opts.split_string.charCodeAt(0);
        }
        // split_byte overrides split_string
        if (opts.split_byte !== undefined) {
            this._split_byte = opts.split_byte;
        }
        // we set the readable side to objectMode, in any case, so that the
        // individual buffers we emit will not be fused to each other
        this['_readableState'].objectMode = true;
    }
    /**
    Decide where the split points are and push chunks onto the stream for
    downstream reading.
    */
    Splitter.prototype.flushBuffer = function (buffer) {
        var cursor = 0;
        for (var i = 0, l = buffer.length; i < l; i++) {
            if (this._split_byte === null) {
                // smart handling of \r and \n
                if (buffer[i] === 13 || buffer[i] === 10) {
                    this.push(buffer.slice(cursor, i));
                    if (buffer[i] === 13 && buffer[i + 1] === 10) {
                        i++;
                    }
                    cursor = i + 1;
                }
            }
            else {
                // naive handling with given split byte
                if (buffer[i] === this._split_byte) {
                    this.push(buffer.slice(cursor, i));
                    cursor = i + 1;
                }
            }
        }
        // set the internal buffer to just the unused part of the buffer
        this._buffer = buffer.slice(cursor);
    };
    /**
    If this._writableState.decodeStrings is true, which it should be, `chunk`
    will be just a buffer, which is what we want.
  
    Node.js 'stream' API calls _transform and _flush.
    In Splitter, both _flush and _transform call flushBuffer, which does most of
    the downstream pushing, but _flush also pushes the final chunk if there is
    one.
    */
    Splitter.prototype._transform = function (chunk, encoding, callback) {
        // chunk is actually going to be a Buffer
        var buffer = Buffer.concat([this._buffer, chunk]);
        this.flushBuffer(buffer);
        callback();
    };
    Splitter.prototype._flush = function (callback) {
        this.flushBuffer(this._buffer);
        if (this._buffer.length > 0) {
            this.push(this._buffer);
        }
        callback();
    };
    return Splitter;
})(stream.Transform);
var JSONParser = (function (_super) {
    __extends(JSONParser, _super);
    function JSONParser(opts) {
        if (opts === void 0) { opts = { objectMode: true }; }
        _super.call(this, opts);
    }
    JSONParser.prototype._transform = function (chunk, encoding, callback) {
        // chunk will be a Buffer, and either one is fine by JSON.parse, but to
        // appease TypeScript, type assert that it's <any>
        callback(null, JSON.parse(chunk));
    };
    return JSONParser;
})(stream.Transform);
/**
Returns one of the seven primitive JSON schema types, or 'undefined':
  array, boolean, integer, number, null, object, string, undefined
(Except it does not actually ever return 'integer'.)
*/
function valueType(value) {
    if (value === undefined) {
        return 'undefined';
    }
    if (value === null) {
        return 'null';
    }
    if (Array.isArray(value)) {
        return 'array';
    }
    // TODO: Ensure that the only other possibilities are 'object', 'boolean', 'number', and 'string'
    return typeof value;
}
/**
Return the schema in schemas such that schema.type == `type`, or `undefined`
if no schema matches.
*/
function find(schemas, type) {
    for (var i = 0, schema; (schema = schemas[i]); i++) {
        if (schema.type == type) {
            return schema;
        }
    }
}
function union(schemas, value) {
    var type = valueType(value);
    if (type == 'undefined') {
        // TODO: handle this case. What should I do with an array of values like
        // `['laugh', 100, undefined]`? change all of the schemas to optional?
        // schemas.forEach(schema => schema.optional = true);
        return schemas;
    }
    // find a pre-existing schema, if there is one
    var schema = find(schemas, type);
    if (schema === undefined) {
        // if the schema is unset, there's no precedent, so it's easy
        schema = types.createEmptySchema(type);
        schemas.push(schema);
    }
    // merge into existing schema.
    if (type == 'object') {
        // only the nested types, object and array (below), require merging.
        var object_schema = schema;
        for (var key in value) {
            // should we actually do the `hasOwnProperty` check?
            if (value.hasOwnProperty(key)) {
                object_schema.properties[key] = union(object_schema.properties[key] || [], value[key]);
            }
        }
    }
    else if (type == 'array') {
        // throw new Error('array merge not yet supported');
        var array_schema = schema;
        value.forEach(function (item) {
            array_schema.items = union(array_schema.items, item);
        });
    }
    else {
    }
    return schemas;
}
function generalizeArray(values) {
    return values.reduce(function (accumulator_schemas, value) {
        return union(accumulator_schemas, value);
    }, []);
}
exports.generalizeArray = generalizeArray;
/**
The given readable stream should emit 'data' events that are native Javascript
values/objects.
*/
function generalizeStream(readable_stream, callback) {
    var accumulator_schemas = [];
    readable_stream
        .on('data', function (value) {
        accumulator_schemas = union(accumulator_schemas, value);
    })
        .on('error', function (error) {
        callback(error);
    })
        .on('end', function () {
        callback(null, accumulator_schemas);
    });
}
exports.generalizeStream = generalizeStream;
function main() {
    var argvparser = yargs
        .usage('Usage: generalize <objects.json')
        .describe({
        help: 'print this help message',
        version: 'print version',
    })
        .alias({
        h: 'help',
    })
        .boolean([
        'help',
    ]);
    var argv = argvparser.argv;
    if (argv.help) {
        argvparser.showHelp();
    }
    else if (argv.version) {
        console.log(require('./package').version);
    }
    else {
        // split input on newlines and parse each one as JSON
        generalizeStream(process.stdin.pipe(new Splitter()).pipe(new JSONParser()), function (error, schemas) {
            console.log(JSON.stringify(schemas));
        });
    }
}
exports.main = main;
