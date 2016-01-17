var express = require('express');
var router = express.Router();
var Evernote = require('evernote').Evernote;
var request = require('superagent');
var enml = require('enml-js');
var User = require('../models_mongo/user');
var Post = require('../models_mongo/post');
var SourcePost = require('../models_mongo/sourcePost');
var cheerio = require('cheerio');

// grab the Mixpanel factory
var Mixpanel = require('mixpanel');
// create an instance of the mixpanel client
var mixpanel = Mixpanel.init('9e69e6fd2cfc2749fe0cc2d8e08d715c');

module.exports = function(passport) {

  /* GET about page. Showcase who and why am I doing this project*/
  router.get('/about', function(req, res){
  res.render('about');
  mixpanel.track("about page loaded");
  });

  router.get('/faq', function(req, res){
  res.render('faq');
  mixpanel.track("faq page loaded");
  });

  /* GET home page. Display the landing page and have a signup and login button*/
  router.get('/', function(req, res){
    res.render('index', { 
      user: req.user, 
      title: 'Blogwith Evernote, Simplenote & Onenote'
      });
    mixpanel.track("index page loaded");
  });

  router.get('/account', ensureAuthenticated, function(req, res){
    //ensureAuthenticated helps to do error checking to see if got login, if not it will go to 

    console.log("Evernote Token: " + JSON.stringify(req.user.evernote.token));

    var ipAdd = req.headers['x-forwarded-for'] || 
     req.connection.remoteAddress || 
     req.socket.remoteAddress ||
     req.connection.socket.remoteAddress;

    var client = new Evernote.Client({
      token: req.user.evernote.token,
      sandbox: false
    });

    // Get User profile
    getUserProfile(client);

    // Create notebook
    // hotfix
    console.log("Creating notebook")
    createNotebook(client, req.user);

    res.render('account', { 
      user: req.user,
      title: 'Account',
      message: req.flash('wpMessage')
    });
    console.log(req.user);
    console.log("Header: " + ipAdd);
    // after rending account, share message that notebook is created
    mixpanel.people.set(req.user.local.email, {
    $email: req.user.local.email,
    $created: (new Date()).toISOString(),
    $ip: ipAdd,
    $name: req.user.wordpress.display_name,
    en_id: req.user.evernote.id,
    en_notebook_id: req.user.evernote.notebook_guid,
    wp_site_id: req.user.wordpress.token_site_id

    });
  });

  // Signup with local
  router.get('/signup', ensureAuthenticated, function(req, res){
  //ensureAuthenticated helps to do error checking to see if got login, if not it will go to 

    console.log("test" + JSON.stringify(req.user.evernote.token));
    mixpanel.track("signup page loaded");

    res.render('signup', { 
      user: req.user, 
      title: 'Signup',
      message: req.flash('signupMessage')
      });
  });

  /* Login is via local email and password. A dropdown modal after login goes into account*/
  router.get('/login', function(req, res){
    res.render('login', { 
      user: req.user,
      title: 'Login',
      message: req.flash('loginMessage')
    });
    mixpanel.track("login page loaded");
  });

    /* Handle Login POST */
  router.post('/login', passport.authenticate('local-login', {
    successRedirect: '/account',
    failureRedirect: '/login',
    }));

  // POST /connect/local
  router.post('/connect/local',
    passport.authenticate('local-signup',{
      successRedirect : '/account', //if success goes to login and setup email and password
      failureRedirect : '/error' //otherwise go back to index or return error page
  }));

  // GET /auth/evernote
  //   Use passport.authenticate() as route middleware to authenticate the
  //   request.  The first step in Evernote authentication will involve redirecting
  //   the user to evernote.com.  After authorization, Evernote will redirect the user
  //   back to this application at /auth/evernote/callback
  router.get('/auth/evernote',
    passport.authenticate('evernote'),
    function(req, res){
      // The request will be redirected to Evernote for authentication, so this
      // function will not be called.
    });

  // GET /auth/evernote/callback
  //   Use passport.authenticate() as route middleware to authenticate the
  //   request.  If authentication fails, the user will be redirected back to the
  //   login page.  Otherwise, the primary route function function will be called,
  //   which, in this example, will redirect the user to the home page.
  router.get('/auth/evernote/callback', 
    passport.authenticate('evernote', {
      successRedirect : '/signup', //if success goes to login and setup email and password
      failureRedirect : '/login' //otherwise go back to index or return error page
  }));

  // GET /connect/wordpress
  router.get('/connect/wordpress',
    passport.authorize('wordpress'),
    function(req, res){
    });

    // GET /connect/wordpress/callback
  router.get('/connect/wordpress/callback', 
    passport.authorize('wordpress', { failureRedirect: '/signin' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/account');
  });

  router.get('/logout', function(req, res){
    req.logout();
    res.redirect('/');
  });

  // Evernote Webhook //
  //[base URL]/?userId=[user ID]&notebookGuid=[notebook GUID]&reason=notebook_update
  var handleRequest;
  router.get('/webhook/evernote', function(req, res){
    console.log('Processing: New webhook from evernote');
    handleRequest = req;
    res.send('OK');
    handleEvernoteRequest(handleRequest);
  });

  return router;
}

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.


function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}

function getUserProfile (client) {
      //GET user profile
  var userStore = client.getUserStore();
  userStore.getUser(function(err, user) {
    // run this code
    console.log('Getting User Profile');
  });
}

function listNotebooks (client) {
  var noteStore = client.getNoteStore();
  noteStore.listNotebooks(function(err, notebooks) {
    // run this code
    console.log('Listing Notebooks');
  });
}

function createNotebook (client, user_details) {
  var noteStore = client.getNoteStore();

  console.log("Creating Notebook");
  //Must give it a name
  var notebook = new Evernote.Notebook();   
  notebook.name = 'BlogwithPublish';

  noteStore.createNotebook(notebook, function(err, createdNotebook) {
    // run this code
    if (err) {
      // might throw error if name already
      // so need to check if name is available
      console.log("Error Creating Notebook: " + err);
      console.log(err.errorCode);
      if (err.errorCode === 10) {
        console.log('Notebook already exist');
      }
    } else {
      // Pull out the GUID
      User.findOne({ 'evernote.id' : user_details.evernote.id }, function(err, user) {
        // if there is an error, stop everything and return that
        // if an error connecting to the database
        if (!user) {
            console.log('Cannot find user' + err);
        }

        // if the user is found then log them in
        if (user) {
          console.log('Retrieved Notebook GUID ' + createdNotebook.guid);
          user.evernote.notebook_guid = createdNotebook.guid;
          user.save(function(err) {
            if (err) {
              console.log(err);
            }
          });
        } 
      });
    }
  });
}

// Create post in wordpress
function createPostInWordpress (req, user, html, title) {
  // new note created in note
  // take all content and title
  console.log('The token is ' + user.wordpress.token);

  var testToken = ('Bearer ' + user.wordpress.token);

  console.log(testToken);
  request.post('https://public-api.wordpress.com/rest/v1.1/sites/'+user.wordpress.token_site_id+'/posts/new/')
    .set('authorization', testToken)
    .send({ title: title })
    .send({ content: html })
    .send({ tags: 'blogwith' })
    .end(function(err, res){
      if (res.error) {
        console.log('oh no ' + res.error.message);
      } else {
        console.log('got ' + res.status + ' response');
        console.log('Wordpress ID:' +  res.body.ID);
        if (res.status === 200) {

          var post = new Post();

          post.data.notebook_guid = req.query.notebookGuid;
          post.data.note_guid = req.query.guid;
          post.data.post_id = res.body.ID;
          post.data.content = html;
          post.data.title = title;
          post.data.source_provider = user.evernote.provider;
          post.data.dest_provider = user.wordpress.provider;
          post.data.evernote_id   = req.query.userId;
          post.data.dest_provider_site_id = user.wordpress.token_site_id;

          post.save(function(err) {
              if (err) {
                throw err;
              } else {
                console.log("New post created and save to database");
              }
          });
        }
      }
    });
}



    // Updating post in wordpress
    // https://public-api.wordpress.com/rest/v1.1/sites/$site/posts/$post_ID
    function updatePostToWordpress (req, user, html, title) {
      console.log("Testing update with " + req.query.guid);

      Post.findOne({ 'data.note_guid' : req.query.guid }, function(err, post) {
      // if there is an error, stop everything and return that
      // if an error connecting to the database
      if (!post) {
          console.log('Cannot find post' + err);
          //console.log('creating new post' + err);
          // since cannot find post
          // Try to create new post 
          // this way can drop note into the notebook.
          //createPostInWordpress(req, user, html, title);
      }

      // found post.
      if (post) {
        console.log('updating to wordpress');
        console.log('The token is ' + user.wordpress.token);
        var testToken = ('Bearer ' + user.wordpress.token);
        console.log(testToken);

        if (post.data.title === title) {
          console.log('No Change in title');
              request.post('https://public-api.wordpress.com/rest/v1.1/sites/'+user.wordpress.token_site_id+'/posts/' + post.data.post_id)
          .set('authorization', testToken)  
          .send({ content: html })
          .end(function(err, res){
            if (res.error) {
              console.log('oh no ' + res.error.message);
            } else {
              console.log('got ' + res.status + ' response');
              if (res.status === 200) {
                //can send email to user 
                //can update database too.
              }
            }
          });
        } else {
          console.log(' Change in title');
          request.post('https://public-api.wordpress.com/rest/v1.1/sites/'+user.wordpress.token_site_id+'/posts/' + post.data.post_id)
          .set('authorization', testToken)  
          .send({ title: title })
          .send({ slug: title })
          .send({ content: html })
          .end(function(err, res){
            if (res.error) {
              console.log('oh no ' + res.error.message);
            } else {
              console.log('got ' + res.status + ' response');
              if (res.status === 200) {
                //can send email to user 
                //can update database too.
              }
            }
          });
        }
      } 
    });
}

function processingHtml(noteContent) {
    var html = enml.HTMLOfENML(noteContent);
    $ = cheerio.load(html, {
      normalizeWhitespace: true,
    });
    //console.log('HTML: ' + html);
    
    $('div').each(function() {
    // if find br 
    // skip adding 
    // if not 
    // add 
    //console.log(1 + " " + $(this).html());
    var p;
    if ($(this).find('br') == '<br clear="none">') {
      console.log('got space no need add')
      //p = $('<p>' + $(this).html() + '</p>');
      console.log($(this).html());
      p = $(this);
      p = p.find('br').removeAttr('clear');
    } else {
      console.log('need add')
      p = $('<p>' + $(this).html() + '</p>');
    }
      $(this).replaceWith(p);
    });

    $('p').last().after('<br><p>Posted via <a href="http://blogwith.co">blogwith</a></p>');
    var fullProcessedHtml = $.html()
    
    return fullProcessedHtml;
}

// markdown processing 
function processingMarkdown(noteContent) {
    var text = enml.PlainTextOfENML(noteContent);
    console.log("Processing To Markdown");
    console.log(text);
    var editedText = text + "<br\/><br\/>Posted via [Blogwith.co](blogwith.co)";
    return editedText;
}

function checkWithSource(req, user, processedHtml, note) {

    SourcePost.findOne({'data.note_guid' : note.guid }, function (err, source) {
    console.log('Finding post in source database');

        if (err) {
            console.log('There is an error: noteStore.getNote');
        }
        if (!source) {
            console.log('Did not find note_id in sourcePost');
            var newPost = new SourcePost();
            console.log('preparing to save to sourcePost');
            // set all of the user data that we need
            newPost.data.note_guid   = req.query.guid;
            newPost.data.source_provider    = user.evernote.provider;
            newPost.data.evernote_id   = user.evernote.id;

            // save the sourcePost into the database
            newPost.save(function(err) {
                if (err) {
                    console.log('error at saving stage');
                } else {
                    console.log("Success: Saved to sourcePost database");
                    console.log('After saving, create post in Wordpress');
                    createPostInWordpress(req, user, processedHtml, note.title);
                }
            });

        } else {
            console.log('Found note_id in sourcePost: prepare for update');
            updatePostToWordpress(req, user, processedHtml, note.title);
        }
    });
}

function handleEvernoteRequest (req) {
    // console.log(req.query.userId);
    // console.log(req.query.notebookGuid);
    // console.log(req.query.reason);
    // console.log(req.query.guid);
    // Use this to check if userId is available 
    // and also check if noteID & notebookGuid correct a not
    // and also what is the reason > catering for create and update 

    if (req.query.guid) {
      console.log('Checking for database for Evernote ID')
      User.findOne({ 'evernote.id' : req.query.userId }, function(err, user) {
        // if there is an error, stop everything and return that
        // if an error connecting to the database
        if (!user) {
            console.log('Cannot find user' + err);
        }
        // user found
        if (user) {
          console.log('User found');
          // check if the notebook is correct
          console.log('Request Notebook ID is ' + req.query.notebookGuid);
          console.log('User Notebook ID is ' + user.evernote.notebook_guid);
          if (req.query.notebookGuid === user.evernote.notebook_guid) {
            // fetch the note content
            mixpanel.track("new post loaded");
            var client = new Evernote.Client({
                token: user.evernote.token,
                sandbox: false
            });
            var noteStore = client.getNoteStore();
            var noteGuid = req.query.guid;

            noteStore.getNote(noteGuid, true, true, true, true, function(err, note) {
                if (err) {
                    console.log('There is an error: noteStore.getNote');
                    console.log('Error is :' + err);
                }

                if (note) {
                    console.log('Processing note content');
                    //console.log(note.resources);
                    var processedHtml;

                    noteStore.getNoteTagNames(noteGuid,function(err, tags) {
                        
                        if (err) {
                            console.log('Get Tags Error:' + err);
                        }

                        if (tags) {
                            console.log("The tags are: ", tags);
                            // check for tags
                            var markdown = false;
                            var published = false;
                            var arrayLength = tags.length;
                            for (var i=0; i < arrayLength; i++) {
                                // if markdown
                                // process as markdown
                                console.log(tags[i]);
                                if (tags[i] === "bw_markdown") {
                                    //process as markdown
                                    markdown = true;   
                                } else if (tags[i] === "bw_published") {
                                    published = true;
                                }
                            }
                            if (markdown && published) {
                                console.log("process as markdown and published")
                                processedHtml = processingMarkdown(note.content);
                                checkWithSource(req, user, processedHtml, note);
                            } else if (published) {
                                console.log("process as html and published")
                                processedHtml = processingHtml(note.content);
                                checkWithSource(req, user, processedHtml, note);
                            }
                        }

                        if (!tags) {
                            console.log("no tags");
                        }
                    });
                }
            });

          } else {
            console.log('Content not from BlogwithPublish');
          }
        } 
      });
    }
}

