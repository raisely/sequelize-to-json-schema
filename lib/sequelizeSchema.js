const _ = require('lodash');
const plural = require('pluralize');

// Maps from sequelize type to json schema type
const typeMap = {
	INTEGER: 'integer',
	BIGINT: 'integer',

	STRING: 'string',

	JSON: 'object',
	JSONB: 'object',

	ARRAY: 'array',
	ENUM: 'string',
	DATE: 'string',
};

class JsonSchema {
	/**
	  * @param {Object} options.associations
	  * @param {Object} options.customSchema
	  * @param {String} options.hrefBase
	  * @param {function} options.jsonAssociationMapper
	  * @param {function} options.jsonAttributeMapper
	  * @param {function} options.selectAttributes
	  * @param {String} options.propertyRoot
	  */
	constructor(model, options = {}) {
		if (!model || !model.tableName) {
			throw new Error(`Are you sure model is a sequelize model class? ${model}`);
		}
		this.model = model;
		this.options = options;

		if (!(options.hrefBase && _.isString(options.hrefBase))) {
			throw new Error('Please specify a string for options.hrefBase');
		}

		if (!options.hrefBase.endsWith('/')) {
			options.hrefBase += '/';
		}

		this.options.propertyRoot = this.options.propertyRoot || '';

		this.customSchema = this.options.customSchema || {};
	}

	getJsonAttribute(modelAttr) {
		if (this.options.jsonAttributeMapper) {
			return this.options.jsonAttributeMapper(this.model, modelAttr);
		}

		return modelAttr;
	}

	selectAttributes() {
		if (this.options.selectAttributes) return this.options.selectAttributes(this.model);

		return Object.keys(this.model.attributes);
	}

	getAssociationKeys(key) {
		if (this.options.jsonAssociationMapper) {
			return this.options.jsonAssociationMapper(this.model, key);
		}

		if (this.model.associations[key]) return [key, key];

		return [false, false];
	}

	getSchema(attributes) {
		const result = this.boilerPlate();

		result.properties = this.getProperties(attributes);

		return result;
	}

	getProperties(attributes) {
		const selectedAttributes = attributes || this.selectAttributes();

		let properties = {};

		selectedAttributes.forEach((key) => {
			const [jsonKey, property] = this.schemaForAttribute(key);

			property.title = `${_.capitalize(_.lowerCase(key))}`;

			if (this.customSchema[this.model.name] && this.customSchema[this.model.name][jsonKey]) {
				Object.assign(property, this.customSchema[this.model.name][jsonKey]);
			}

			if (property.enum) {
				property.examples = _.uniq(property.examples.concat(property.enum));
			}

			properties[jsonKey] = property;
		});

		// Sort the object keys
		properties = _.fromPairs(_.toPairs(properties).sort((a, b) => a[0].localeCompare(b[0])));

		return properties;
	}

	getAttributeId(key) {
		return `${this.options.propertyRoot}/properties/${key}`
	}

	schemaForAttribute(modelAttr) {
		let jsonKey;
		let property;
		[jsonKey, property] = this.getAssociationSchema(modelAttr);

		if (property) return [jsonKey, property];

		jsonKey = this.getJsonAttribute(modelAttr);

		property = {
			$id: this.getAttributeId(jsonKey),
			type: this.getJsonSchemaType(modelAttr),
			examples: [],
		};

		if (this.getDbType(modelAttr) === 'ENUM') {
			property.enum = this.model.attributes[modelAttr].type.values;
		}

		return [jsonKey, property];
	}

	getAssociationSchema(key) {
		const [modelKey, jsonKey] = this.getAssociationKeys(key);
		if (!modelKey) return [false, false];

		const assocType = this.model.associations[modelKey].associationType;

		let property;

		const assocModel = this.model.associations[modelKey].target;

		// Only embed if explicitly directed to
		if (this.options.associations && this.options.associations[jsonKey] === 'inline') {
			const assocSchema = this.options.factory.getSchemaGenerator(assocModel, {
				propertyRoot: this.getAttributeId(jsonKey),
			});

			property = {
				type: 'object',
				properties: assocSchema.getProperties(),
			};
		} else {
			property = {
				$ref: this.constructor.fullUrl(this.options.hrefBase, assocModel),
			};
		}

		// If it's a relationship to multiple records, nest in array
		if (['hasMany', 'belongsToMany'].includes(assocType)) {
			property = {
				type: 'array',
				items: property,
			};
		}

		return [jsonKey, property];
	}

	getDbType(modelAttr) {
		if (modelAttr === 'uuid' || modelAttr.endsWith('Uuid')) {
			return 'STRING';
		}

		if (!this.model.attributes[modelAttr]) {
			throw new Error(`Unknown model attribute ${this.model.name}.${modelAttr}`);
		}
		const dbType = this.model.attributes[modelAttr].type.key;

		return dbType;
	}

	getJsonSchemaType(modelAttr) {
		const dbType = this.getDbType(modelAttr);

		const jsonSchemaType = typeMap[dbType];

		if (!jsonSchemaType) {
			throw new Error(`Don't know how to convert DB type ${dbType} to json schema type (attribute: ${modelAttr})`);
		}

		return jsonSchemaType;
	}

	static modelPath(model) {
		return `${model.name}.json`;
	}

	static fullUrl(base, model) {
		const path = this.modelPath(model);
		return `${base}${path}`;
	}

	/**
	  * Generates the expected boiler plate for a model schema
	  * @return {Object} The boiler plate for a json schema for this model
	  */
	boilerPlate() {
		const title = _.capitalize(plural.singular(this.model.name));

		return {
			title,
			$id: this.constructor.fullUrl(this.options.hrefBase, this.model),
			type: 'object',
			$schema: 'http://json-schema.org/draft-06/schema#',
		};
	}
}

module.exports = JsonSchema;
