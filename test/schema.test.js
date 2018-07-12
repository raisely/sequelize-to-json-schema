const SchemaFactory = require('../lib');
const user = require('./models');
const chai = require('chai');
const chaiSubset = require('chai-subset');

chai.use(chaiSubset);

const expect = chai.expect;

const customSchema = {
	user: { status: { description: 'Was it all just a dream?' } },
};

function selectAttributes(model) {
	if (model.name === 'user') {
		return ['full_name', 'address', 'profile', 'status', 'name'];
	}

	return Object.keys(model.attributes);
}

function jsonAttributeMapper(model, name) {
	return (name === 'full_name') ? 'fullName' : name;
}

describe('SequelizeSchema', () => {
	let schema;

	before(() => {
		const factory = new SchemaFactory({
			customSchema,
			jsonAttributeMapper,
			selectAttributes,
			associations: { user: { address: 'inline' } },
			hrefBase: 'schema.example',
		});
		const schemaGenerator = factory.getSchemaGenerator(user);
		schema = schemaGenerator.getSchema();
	});

	describe('boiler plate', () => {
		it('is correct', () => {
			const expected = {
				title: 'User',
				$id: 'schema.example/user.json',
				type: 'object',
				$schema: 'http://json-schema.org/draft-06/schema#',
			};

			expect(schema).to.containSubset(expected);
		});
	});
	describe('attributes', () => {
		it('includes expected attributes', () => {
			const expected = {
				properties: {
					name: { type: 'string', title: 'Name' },
					status: { type: 'string', title: 'Status', enum: ['REAL', 'IMAGINED'] },
					fullName: { type: 'string', title: 'Full name' },
				},
			};

			expect(schema).to.containSubset(expected);
		});
		it('merges custom schema', () => {
			const expected = {
				properties: {
					status: customSchema.user.status,
				},
			};
			expect(schema).to.containSubset(expected);
		});
		it("omits ones that aren't selected", () => {
			expect(schema).to.not.containSubset({ properties: { password: {} } });
		});
	});
	describe('associations', () => {
		it('inserts inline', () => {
			expect(schema.properties.address.items.properties).to.containSubset({
				country: {
					$id: '/properties/address/properties/country',
					type: 'string',
				},
			});
		});
		it('puts hasMany in array', () => {
			expect(schema.properties.address.type).to.eq('array');
		});
		it('puts $id in array types also', () => {
			expect(schema.properties.address.$id).to.eq('/properties/address');
		});
		it('adds $ref', () => {
			expect(schema.properties.profile).to.containSubset({
				$ref: 'schema.example/profile.json',
			});
		});
	});
});
