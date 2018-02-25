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

			if (this.customSchema[key]) {
				Object.assign(property, this.customSchema[key]);
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
	itDocumentsAssociations(response) {
		const associations = {
			profile: { $ref: '/v3/schema/profiles.json' },
			totals: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						total: {
							title: 'Total raised (in cents)',
							type: 'integer',
							examples: [],
						},
						currency: {
							title: 'Currency',
							type: 'string',
							examples: [],
						},
						mode: {
							type: 'string',
							enum: ['LIVE', 'TEST'],
							examples: ['LIVE'],
						},
					},
				},
			},
		};

		expect(response.body.properties).to.shallowDeepEqual(associations);
	}
}


module.exports = SchemaHelper;
