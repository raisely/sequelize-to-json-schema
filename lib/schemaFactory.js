const SequelizeSchema = require('./sequelizeSchema');
const TestHelper = require('./testHelper');

class SchemaFactory {
	constructor(options) {
		this.options = options || {};
	}

	getSchemaGenerator(model, options) {
		const opts = Object.assign({ factory: this }, this.options, options || {});
		return new SequelizeSchema(model, opts);
	}

	getTestHelper(model, options) {
		const opts = Object.assign({}, this.options, options || {});
		return new TestHelper(model, opts);
	}
}

module.exports = SchemaFactory;
