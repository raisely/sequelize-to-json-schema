const _ = require('lodash');
const plural = require('pluralize');

// Maps from sequelize type to json schema type
const typeMap = {
	INTEGER: 'integer',
	BIGINT: 'integer',
	FLOAT: 'number',
	BOOLEAN: 'boolean',

	STRING: 'string',
	TEXT: 'string',

	JSON: 'object',
	JSONB: 'object',

	ARRAY: 'array',
	ENUM: 'string',
	DATE: 'string',
};

class JsonSchema {
	/**
	  * @param {Object} options.associations Define associations to be inlined for all models
	  * @param {Object} options.customSchema Custom schema to merge with the generated schema
	  * @param {Object} options.factory The schemaFactory used to obtain generators for associations
	  * @param {String} options.hrefBase Base url for schema urls
	  * @param {function} options.jsonAssociationMapper fn(model, assocName)
	  Map associations to [modelAttrName, jsonAttrName]
	  * @param {function} options.jsonAttributeMapper fn(model, attr)
	  Map attributes to json schema attribute name
	  * @param {String} options.propertyRoot Root path for properties
	  (used internally for nesting objects)
	  * @param {function} options.selectAttributes fn(model)
	  Function to select which attributes from a model to use
	  * @param {function} options.virtualProperties Optional schema for properties
	  that are not generated
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

	/**
	  * Get the json schema name of the given model attribute
	  * Defers to this.options.jsonAttributeMapper(this.model, modelAttr) if
	  * it is defined. Otherwise simply returns modelAttr
	  * @param {String} modelAttr name of the sequelize model attribute
	  * @return {String} Name for the attribute in the json schema
	  */
	getJsonAttribute(modelAttr) {
		if (this.options.jsonAttributeMapper) {
			return this.options.jsonAttributeMapper(this.model, modelAttr);
		}

		return modelAttr;
	}

	/**
	  * Select the attributes for this model
	  * Defers to this.options.selectAttributes(this.model) or
	  * returns all attributes on the model and concats this.options.associations
	  * @return {String[]} Array of attribute names
	  */
	selectAttributes() {
		let attributes = this.options.selectAttributes ?
			this.options.selectAttributes(this.model) :
			Object.keys(this.model.attributes);

		attributes = attributes.concat(this.selectAssociations());

		return attributes;
	}

	selectAssociations() {
		if (this.options.associations[this.model.name]) {
			return Object.keys(this.options.associations[this.model.name]);
		}

		return [];
	}

	/**
	  * Get the model and json schema names for an association
	  *
	  * Defers to this.options.jsonAssociationMapper(this.model, key) if it exists
	  * or returns [key, key]
	  * returns [false,false] if key is not the name of a known association
	  *
	  * @param {String} key The name of the attibute to look up
	  * @return {Array} [modelAttrName, jsonAttrName]
	  */
	getAssociationKeys(key) {
		if (this.options.jsonAssociationMapper) {
			return this.options.jsonAssociationMapper(this.model, key);
		}

		if (this.model.associations[key]) return [key, key];

		return [false, false];
	}

	/**
	  * Get the json schema for the model this generator represents
	  * @param {String[]} attributes optional list of attributes to define
	  * @return {Object} the schema definition for the model
	  */
	getSchema(attributes) {
		const result = this.boilerPlate();

		result.properties = this.getProperties(attributes);

		return result;
	}

	/**
	  * Return the properties definition for the model this schema generator
	  * represents
	  * If attributes is undefined, then options.selecAttributes() will
	  * be called, or failing that, simply take the list of attributes from
	  * the model
	  * @param {String[]} attributes optional list of attributes to define
	  * @return {Object} the properties definition for the model
	  */
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

		// Inject the virtual properties into the customSchema
		if (this.options.virtualProperties && this.options.virtualProperties[this.model.name]) {
			_.forEach(this.options.virtualProperties[this.model.name], (property, attr) => {
				properties[attr] = Object.assign({},
					property,
					this.generatePropertySchema({
						key: attr,
						type: property.type,
					})
				);
			});
		}

		// Sort the object keys
		properties = _.fromPairs(_.toPairs(properties).sort((a, b) => a[0].localeCompare(b[0])));

		return properties;
	}

	/**
	  * Return the id to be used for an attribute
	  */
	getAttributeId(key) {
		return `${this.options.propertyRoot}/properties/${key}`;
	}

	/**
	  * Return the schema for an attribute, could be an association or a property
	  * @param {String} modelAttr the name of the attribute to get the schema for
	  * @return {Array} [jsonAttributeName, propertyDefinition]
	  */
	schemaForAttribute(modelAttr) {
		let jsonKey;
		let property;
		[jsonKey, property] = this.getAssociationSchema(modelAttr);

		if (property) return [jsonKey, property];

		jsonKey = this.getJsonAttribute(modelAttr);

		const type = this.getDbType(modelAttr);

		property = this.generatePropertySchema({
			type,
			key: jsonKey,
		});

		if (this.getDbType(modelAttr) === 'ENUM') {
			property.enum = this.model.attributes[modelAttr].type.values;
		}

		return [jsonKey, property];
	}

	generatePropertySchema({ type, key }) {
		return {
			type: typeMap[type],
			$id: this.getAttributeId(key),
			examples: [],
			title: `${_.capitalize(_.lowerCase(key))}`,
		};
	}

	/**
	  * Get the schema snippet to use for an association
	  * @param {String} key The attribute name of the association
	  * @returns {Array} [jsonAttributeName, definition]
	  */
	getAssociationSchema(key) {
		const [modelKey, jsonKey] = this.getAssociationKeys(key);
		if (!modelKey) return [false, false];

		const assocType = this.model.associations[modelKey].associationType;

		let property;

		const assocModel = this.model.associations[modelKey].target;

		// Only embed if explicitly directed to
		if (this.options.associations
			&& this.options.associations[this.model.name]
			&& this.options.associations[this.model.name][jsonKey] === 'inline') {
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
		if (['HasMany', 'hasMany', 'BelongsToMany', 'belongsToMany'].includes(assocType)) {
			property = {
				type: 'array',
				items: property,
			};
		}

		property.$id = this.getAttributeId(key);

		return [jsonKey, property];
	}

	/**
	  * Get the type value used by sequelize for the attribute
	  * @param {String} modelAttr The name of the attribute (as per the sequelize model)
	  * @returns {String} The sequelize type of the attribute
	  * @throws {Error} If the attribute cannot be found in the model
	  * @throws {Error} if it doesn't know how to map from the database type to the json schema type
	  */
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

	/**
	  * Get the type value to be used in JSON schema
	  * @param {String} modelAttr The name of the attribute (as per the sequelize model)
	  * @returns {String} A type suitable for use in JSON schema
	  * @throws {Error} if it doesn't know how to map from the database type to the json schema type
	  */
	getJsonSchemaType(modelAttr) {
		const dbType = this.getDbType(modelAttr);

		const jsonSchemaType = typeMap[dbType];

		if (!jsonSchemaType) {
			throw new Error(`Don't know how to convert DB type ${dbType} to json schema type (attribute: ${modelAttr})`);
		}

		return jsonSchemaType;
	}

	/**
	  * Generate the path for a model
	  * @param {Model} model The sequelize model to generate it for
	  * @returns {String}
	  */
	static modelPath(model) {
		return `${model.name}.json`;
	}

	/**
	  * Generate a url for use in $id and $ref
	  * @param {String} base The base path
	  * @param {Model} model The sequelize model to generate it for
	  * @returns {String}
	  */
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
