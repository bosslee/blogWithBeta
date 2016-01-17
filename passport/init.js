
// load the strategy required
var EvernoteStrategy = require('passport-evernote').Strategy;
var WordpressStrategy = require('passport-wordpress').Strategy;
var LocalStrategy   = require('passport-local').Strategy;

// load the auth variables
var configAuth = require('../passport/auth');
var User = require('../models_mongo/user');

var bCrypt   = require('bcrypt-nodejs');

module.exports = function(passport) {

    // used to serialize the user for the session
    passport.serializeUser(function(user, done) {
        console.log("serializeUser: " + user._id);
        done(null, user._id);
        //done(null,user);
    });

    // used to deserialize the user
    passport.deserializeUser(function(id, done) {
        User.findOne({'_id':id}, function(err, user) {
            console.log("deserializeUser: " + user);
            done(err, user);
        });
        //done(null,id);
    });

    // =========================================================================
    // Evernote =================================================================
    // =========================================================================
    passport.use(new EvernoteStrategy({

        requestTokenURL: 'https://www.evernote.com/oauth',
        accessTokenURL: 'https://www.evernote.com/oauth',
        userAuthorizationURL: 'https://www.evernote.com/OAuth.action',
        consumerKey: configAuth.evernoteAuth.consumerKey,
        consumerSecret: configAuth.evernoteAuth.consumerSecret,
        callbackURL: configAuth.evernoteAuth.callbackURL,
        passReqToCallback : true 
        // allows us to pass back the entire request to the callback
    },
    function(req, token, tokenSecret, profile, done) {

    // make the code asynchronous
    // User.findOne won't fire until we have all our data back from Evernote
        process.nextTick(function() {
            User.findOne({ 'evernote.id' : profile.id }, function(err, user) {

                // if there is an error, stop everything and return that
                // if an error connecting to the database
                if (err)
                    return done(err);

                // if the user is found then log them in
                if (user) {
                    console.log('found user');
                    return done(null, user, req.flash('signupMessage', 'Welcome Back!')); 
                    // user found, return that user

                } else {
                    // if there is no user, create them
                    var newUser                 = new User();

                    // set all of the user data that we need
                    newUser.evernote.provider   = profile.provider;
                    newUser.evernote.id          = profile.id;
                    newUser.evernote.shard      = profile.shard;
                    newUser.evernote.token       = token;

                    // save our user into the database
                    newUser.save(function(err) {
                        if (err)
                            throw err;
                        return done(null, newUser, req.flash('signupMessage', 'Welcome! Your Evernote account has been connected.'));
                    });
                }
            });

        });

    }));

    // =========================================================================
    // Wordpress =================================================================
    // =========================================================================

    passport.use(new WordpressStrategy({
    clientID: configAuth.wordpressAuth.clientID,
    clientSecret: configAuth.wordpressAuth.clientSecret,
    callbackURL: configAuth.wordpressAuth.callbackURL,
    passReqToCallback: true
      },
      function(req, accessToken, refreshToken, profile, done) {
        process.nextTick(function() {
            if (!req.user) {
              // Not logged-in.
              console.log('Not logged-in.');

            } else {
              // Logged in. Associate Wordpress account with user.  Preserve the login
              // state by supplying the existing user after association.
              // return done(null, req.user);
              console.log(profile._json.email);
              var user = req.user;
              user.wordpress.provider = profile.provider;
              user.wordpress.id = profile._json.id;
              user.wordpress.display_name = profile._json.display_name;
              user.wordpress.username = profile._json.username;
              user.wordpress.email = profile._json.email;
              user.wordpress.token_site_id = profile._json.token_site_id;
              user.wordpress.token = accessToken;
              user.wordpress.refreshToken = refreshToken;

              console.log('Wordpress: ' + accessToken);
              user.save(function(err) {
                    if (err)
                        throw err;
                    return done(null, user, req.flash('wpMessage', 'Nice! Your wordpress account has been connected.'));
                });
            }
        });
      }
    ));

    // =========================================================================
    // LOCAL SIGNUP =============================================================
    // =========================================================================

    passport.use('local-signup', new LocalStrategy({
        // by default, local strategy uses username and password, we will override with email
        usernameField : 'email',
        passwordField : 'password',
        passReqToCallback : true // allows us to pass back the entire request to the callback
    },
    function(req, email, password, done) { // callback with email and password from our form

        // find a user whose email is the same as the forms email
        // we are checking to see if the user trying to login already exists
        User.findOne({ 'local.email' :  email }, function(err, user) {
            // if there are any errors, return the error before anything else
            if (err)
                return done(err);

            // if no user is found, return the message
            if (!req.user) {
              return done(null, false, req.flash('loginMessage', 'Not Connected To Evernote.')); // req.flash is the way to set flashdata using connect-flash
            } else {
              console.log(email);
              var user = req.user;
              // set the user's local credentials
              user.local.email = email;
              user.local.password = createHash(password)

              user.save(function(err) {
                    if (err)
                        throw err;
                    return done(null, user);
              });
            }

        });

    }));

    // =========================================================================
    // LOCAL LOGIN =============================================================
    // =========================================================================
    // we are using named strategies since we have one for login and one for signup
    // by default, if there was no name, it would just be called 'local'

    passport.use('local-login', new LocalStrategy({
        // by default, local strategy uses username and password, we will override with email
        usernameField : 'email',
        passwordField : 'password',
        passReqToCallback : true // allows us to pass back the entire request to the callback
    },
    function(req, email, password, done) { // callback with email and password from our form

        // find a user whose email is the same as the forms email
        // we are checking to see if the user trying to login already exists
        User.findOne({ 'local.email' :  email }, function(err, user) {
            // if there are any errors, return the error before anything else
            console.log('Email Checking:' + email);
            if (err) {
                console.log(err);
                return done(err);
            }

            // if no user is found, return the message
            if (!user)
                return done(null, false, req.flash('loginMessage', 'No user found.')); // req.flash is the way to set flashdata using connect-flash

            // if the user is found but the password is wrong
            if (!isValidPassword(user, password)){
              console.log('Invalid Password');
              return done(null, false, 
                  req.flash('message', 'Invalid Password'));
            }

            // all is well, return successful user
            console.log('Login Okie');
            return done(null, user);
        });

    }));

};


var isValidPassword = function(user, password){
  return bCrypt.compareSync(password, user.local.password);
}

// Generates hash using bCrypt
var createHash = function(password){
 return bCrypt.hashSync(password, bCrypt.genSaltSync(10), null);
}