const _ = require('lodash');

const models = {};

function modelFactory(name, attributes) {
	const model = {
		associate,
		name,
		tableName: name,
		attributes: {},
		associations: {},
	};

	_.forEach(attributes, (value, attr) => {
		const attribute = _.isString(value) ? { key: value } : value;
		model.attributes[attr] = { type: attribute };
	});

	models[name] = model;

	return model;
}

function associate(associations) {
	_.forEach(associations, (assoc) => {
		if (!models[assoc.name]) {
			throw new Error(`Unknown model: ${assoc.name}`);
		}

		this.associations[assoc.name] = Object.assign({
			target: models[assoc.name],
		}, assoc);
	});
}

module.exports = modelFactory;
