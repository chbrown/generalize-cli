function createEmptySchema(type) {
    if (type == 'object') {
        return { type: 'object', properties: {} };
    }
    else if (type == 'array') {
        return { type: 'array', items: [] };
    }
    return { type: type };
}
exports.createEmptySchema = createEmptySchema;
