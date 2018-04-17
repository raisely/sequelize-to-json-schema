# sequelize-to-json-schema
Flexible json-schema generator from sequelize models

[![Build Status](https://travis-ci.org/raisely/sequelize-to-json-schema.svg?branch=master)](https://travis-ci.org/raisely/sequelize-to-json-schema)

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
    // modelName: { attributeName: { <schema> } }
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
An object listing the associations to include in the schema *for all models*
The keys of the objects are the names of models, each key selects an object where
the keys of the object are the association names and the value should be either
'INLINE' or 'REL'.
Use 'INLINE' if you want the association to be presented within the schema instead
of by reference ('REL')

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
This must return an array of strings, where each entry in the array is an attribute.
Use this to prevent all attributes being described by the schema

### options.virtualProperties
Add virtual properties - properties that are not present in the model, but are
generated dynamically whenever a model is converted to JSON.
These take the form of customSchema, but *must* include the attribute type
which contains a string representation of the Sequelize type that the
property would be if it were "real"

```javascript
const options = {
  virtualProperties: {
    users: {
      postCount: { type: 'INTEGER', description: 'Number of posts by the user' },
    },
  },
}
```

## Advanced example

```javascript
const factory = new SchemaFactory({
  customSchema,
  jsonAttributeMapper = (attr) => _.camelCase(attr),
  selectAttributes = () => ['full_name', 'status', 'address', 'profile'],
  associations: { user: { address: 'inline' } },
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

# Contributing

Contributions are welcome. Please submit a pull request and include tests.

Please follow the coding style in `.editorconfig` and `.eslintrc`.

Contributions should pass `npm run test:ci && npm run lint` (see below on testing)

## Testing

Run `npm test`

# License

This software is licensed under the [Just World License](./LICENSE.md).
