const SequelizeSchema = require('./sequelizeSchema');

const _ = require('lodash');
const chai = require('chai');
const shallowDeepEqual = require('chai-shallow-deep-equal');

chai.use(shallowDeepEqual);

const expect = chai.expect;

/**
  * Helper for verifying that schema contains what we want
  */
class SchemaHelper {
	/**
	  * Constructs a helper for the given sequelize model class
	  * @param {Model} model The sequelize model this helper is for
	  */
	constructor(model, options = {}) {
		if (!model || !model.tableName) {
			throw new Error(`Are you sure model is a sequelize model class? ${model}`);
		}
		this.model = model;
		this.customSchema = options.customSchema || {};
		this.options = options;

		this.schema = new SequelizeSchema(model, options);
	}

	/**
	  * Get the model attribute name, calls provided helper if available
	  * to do custom mappings
	  *
	  * @param {String} key The json schema key
	  * @returns {String} The corresponding model attribute name
	  * @throws {Error} if no corresponding model attribute can be found
	  */
	getModelAttribute(key) {
		let modelKey = key;

		if (this.options.modelAttributeMapper) {
			modelKey = this.options.modelAttributeMapper(this.model, key);
		}

		if (!this.model.attributes[modelKey]) {
			throw new Error(`Unknown attribute ${modelKey} (for model ${this.model.name})`);
		}

		return modelKey;
	}
	/**
	  * Asserts that the schema documents all the fields of a given example
	  *
	  * This will take an example object and compare the schema against it
	  * @param {Object} response A HTTP response object (must contain .body)
	  * @param {Object} example An example object to compare against
	  */
	assertAllExampleFields(response, example) {
		let privateSchema = {};
		Object.keys(example).forEach((key) => {
			const modelKey = this.getModelAttribute(key);

			const property = {
				$id: `/properties/${key}`,
				type: this.schema.getJsonSchemaType(modelKey),
				title: `${_.capitalize(_.lowerCase(key))}`,
				examples: [],
			};

			// If it's an enum type, list the allowed values
			if (this.schema.getDbType(modelKey) === 'ENUM') {
				property.enum = this.model.attributes[modelKey].type.values;
			}

			if (this.customSchema[this.model.name]
				&& this.customSchema[this.model.name][key]) {
				Object.assign(property, this.customSchema[this.model.name][key]);
			}

			privateSchema[key] = property;
		});

		privateSchema = _.fromPairs(_.toPairs(privateSchema).sort((a, b) => a[0].localeCompare(b[0])));

		expect(response.body.properties).to.shallowDeepEqual(privateSchema);
	}

	/**
	  * Asserts that the json schema documens all associations
	  * @param {Object} response a http response object, must contain .body
	  */
	assertAssociations(response, associations) {
		const expectedProperties = this.schema.getProperties(associations);

		expect(response.body.properties).to.shallowDeepEqual(expectedProperties);
	}

	assertProperties(response, attributes) {
		const props = {};

		attributes.forEach((attr) => {
			const jsonKey = this.schema.getJsonAttribute(attr);
			props[jsonKey] = {
				$id: `/properties/${jsonKey}`,
			};
		});

		expect(response.body.properties).to.shallowDeepEqual(props);
	}

	boilerPlate() {
		return this.schema.boilerPlate();
	}

	/**
	  * Asserts that all (top level) properties are described fully
	  *
	  * If fields is omitted, the default is ['description', 'examples', 'type', 'title', '$id']
	  *
	  * @param {HttpResponse} response The response object (must contain body)
	  * @param {String[]} fields optional list of attributes that each property must have
	  */
	// eslint-disable-next-line class-methods-use-this
	assertAllPropertiesDescribed(response, fields) {
		// eslint-disable-next-line no-param-reassign
		if (!fields) fields = ['description', 'examples', 'type', 'title', '$id'];

		const missing = {};

		_.forEach(response.body.properties, (prop, key) => {
			// Ignore associations
			if (!prop.$ref) {
				const missingKeys = _.difference(fields, Object.keys(prop));
				if (missingKeys.length) missing[key] = missingKeys;
			}
		});

		if (Object.keys(missing).length) {
			expect(missing, 'Properties are not fully described, see diff for missing properties').to.equal({});
		}
	}
}


module.exports = SchemaHelper;
