# sequelize-to-json-schema
Flexible json-schema generator from sequelize models

Features:
* Rename attributes if they are different in your json schema (eg snake_case to camelCase)
* Include associations using $ref or inline
* Automatically generate examples for enum
* Easily customise your schema with descriptions, examples, validation, etc
* Built for Draft 06

## Example

```javascript

// User model is defined as
// userDefinition = {
//   full_name: Sequelize.STRING,
//   status: {
//     type: Sequelize.ENUM,
//     values: ['REAL', 'IMAGINED'],
//   },
// }
// With associations for hasMany addresses and hasOne profile

const schemaFactory = require('sequelize-to-json-schema');

const factory = new SchemaFactory({
  customSchema: {
    user: { status: { description: 'Was it all just a dream?' } },
  }
  hrefBase: 'http://schema.example',
});
const schemaGenerator = factory.getSchemaGenerator(User);
const schema = schemaGenerator.getSchema();

// Results in
schema = {
  {
    title: 'User',
    '$id': 'http://schema.example/user.json',
    type: 'object',
    '$schema': 'http://json-schema.org/draft-06/schema#',
    properties: {
      full_name: {
        '$id': '/properties/full_name',
        type: 'string',
        examples: [],
        title: 'Full name'
      },
      status: {
        '$id': '/properties/status',
        type: 'string',
        examples: ['REAL', 'IMAGINED'],
        enum: ['REAL', 'IMAGINED'],
        title: 'Status',
        description: 'Was it all just a dream?'
      }
    }
  }
}
```

You can customise your factory by passing options

### options.association
An object where the keys are the names of your associations and the value 'INLINE'
if you want the assocation to be presented within the schema instead of by reference

**NB:** An association must be named by selectAttributes to be included.

### options.customSchema
An object defineing custom information to be placed in the schema.
Top level keys are model names, which contain a objects who's keys are
attribute or association names, and then custom keys to place in your
schema for that attribute.

### options.hrefBase
The base to use for any references

### options.jsonAssociationMapper
A function for mapping association names, it is of the form `jsonAssociationMapper(model, attributeName)`
It must return an array of the form `[modelAttribute, jsonAttribute]`
This is useful if your associations are named differently in your models to how they
are presented in JSON. (eg pluralization or snake_case to camelCase)

If it is unspecified, the schema generator will simply use association names unchanged

**Note** This function must return [false, false] if the given property is not an association


### options.jsonAttributeMapper
A function for mapping attribute names in the model to json schema attributes

eg
```javascript
jsonAttributeMapper = (modelAttr) => toCamelCase(modelAttr);
```

### options.selectAttributes
Selects which attributes to describe in the schema for a given model
`selectAttributes(model)`
This must return an array of strings, where each entry in the array is an attribute
or an association.
Use this to prevent all attributes being described by the schema, or to include
some associations

## Advanced example

```javascript
const factory = new SchemaFactory({
  customSchema,
  jsonAttributeMapper = (attr) => _.camelCase(attr),
  selectAttributes = () => ['full_name', 'status', 'address', 'profile'],
  associations: { address: 'inline' },
  hrefBase: 'http://schema.example',
});
const schemaGenerator = factory.getSchemaGenerator(user);
const const schema = schemaGenerator.getSchema();

schema = {
  title: 'User',
  '$id': 'schema.example/user.json',
  type: 'object',
  '$schema': 'http://json-schema.org/draft-06/schema#',
  properties: {
    address: { type: 'array', items: [Object], title: 'Address' },
    fullName: {
      '$id': '/properties/fullName',
      type: 'string',
      examples: [],
      title: 'Full name'
    },
    profile: { '$ref': 'http://schema.example/profile.json', title: 'Profile' },
    status: {
      '$id': '/properties/status',
      type: 'string',
      examples: ['REAL', 'IMAGINED'],
      enum: ['REAL', 'IMAGINED'],
      title: 'Status',
    }
  }
};
```
