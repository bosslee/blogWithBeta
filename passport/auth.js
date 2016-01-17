//auth.js
//you will need to get the following details from 
// 1. Evernote: https://dev.evernote.com/doc/
// 2. Wordpress: https://developer.wordpress.com/docs/api/

module.exports = {
	'evernoteAuth': {
		consumerKey: 'username-1234',
		consumerSecret: 'a_long_string',
		callbackURL: 'a_url_that_you_use_for_your_callback'
		//callbackURL: 'http://127.0.0.1:3000/auth/evernote/callback'
	},
	'wordpressAuth': {
		clientID: 'a_5_digit_number_',
		clientSecret: 'a_very_long_string',
		callbackURL: 'a_url_that_you_use_for_your_callback'
		//callbackURL: 'http://127.0.0.1:3000/connect/wordpress/callback'
	}
};