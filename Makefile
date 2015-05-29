BIN := node_modules/.bin
DTS := mocha/mocha node/node yargs/yargs

all: index.js
type_declarations: $(DTS:%=type_declarations/DefinitelyTyped/%.d.ts)

%.js: %.ts type_declarations $(BIN)/tsc
	$(BIN)/tsc -m commonjs -t ES5 $<

type_declarations/DefinitelyTyped/%:
	mkdir -p $(@D)
	curl -s https://raw.githubusercontent.com/chbrown/DefinitelyTyped/master/$* > $@

$(BIN)/tsc $(BIN)/mocha:
	npm install

.PHONY: test
test: test/basic.js $(BIN)/mocha
	$(BIN)/mocha test/
