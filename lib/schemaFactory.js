const SequelizeSchema = require('./sequelizeSchema');
const TestHelper = require('./testHelper');

class SchemaFactory {
	/**
	  * Create a factory for schemas
	  * options are passed to the constructor for the sequelizeSchema
	  * @see SequelizeSchema() for definition of options
	  */
	constructor(options) {
		this.options = options || {};
	}

	/**
	  * Get a SequelizeSchema instance for the given model
	  * @param {Model} model A sequelize model to use
	  * @param {Object} options Merged with default options passed to the constructor
	  * @returns {SequelizeSchema}
	  */
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
