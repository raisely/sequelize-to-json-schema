const mocker = require('./mockModel');

const user = mocker('user', {
	name: 'STRING',
	// eslint-disable-next-line camelcase
	full_name: 'STRING',
	status: {
		key: 'ENUM',
		values: ['REAL', 'IMAGINED'],
	},
	password: 'STRING',
});

mocker('address', {	country: 'STRING' });

mocker('profile', {});

user.associate([
	{ name: 'address', associationType: 'hasMany' },
	{ name: 'profile', associationType: 'hasOne' },
]);

module.exports = user;
