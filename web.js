(function() {
  var Db, Server, app, db, express, jade, mongo, openid, port, querystring, relyingParty, server, url;
  express = require('express');
  openid = require('openid');
  url = require('url');
  querystring = require('querystring');
  jade = require('jade');
  mongo = require('mongodb');
  relyingParty = new openid.RelyingParty('http://dev:4000/verify', null, false, false, []);
  Server = mongo.Server;
  Db = mongo.Db;
  server = new Server('localhost', 27017, {
    auto_reconnect: true
  });
  db = new Db('buffsets', server);
  db.open(function(err, db) {
    if (!err) {
      return console.log("We are connected");
    }
  });
  app = express.createServer(express.logger());
  app.configure('development', function() {
    app.use(express.static(__dirname + '/public'));
    return app.use(express.errorHandler({
      dumpExceptions: true,
      showStack: true
    }));
  });
  app.configure('production', function() {
    var oneYear;
    oneYear = 31557600000;
    app.use(express.static(__dirname + '/public', {
      maxAge: oneYear
    }));
    return app.use(express.errorHandler());
  });
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.get('/', function(request, response) {
    return response.render('index');
  });
  app.get('/authenticate', function(request, response) {
    var identifier;
    identifier = 'https://www.google.com/accounts/o8/id';
    return relyingParty.authenticate(identifier, false, function(error, authUrl) {
      if (error) {
        return response.send('Authentication failed: ' + error);
      } else if (!authUrl) {
        return response.send('Authentication failed');
      } else {
        console.log(authUrl);
        response.writeHead(302, {
          Location: authUrl
        });
        return response.end();
      }
    });
  });
  app.get('/verify', function(request, response) {
    return relyingParty.verifyAssertion(request, function(error, result) {
      if (!error && result.authenticated) {
        return response.send(result);
      } else {
        return response.send('Failure :(');
      }
    });
  });
  app.get('/users', function(request, response) {
    return db.collection('users', function(err, collection) {
      return collection.find({
        active: true
      }).toArray(function(err, users) {
        return jade.renderFile('views/users/index.jade', {
          locals: {
            title: 'Buffsets.js - Users',
            users: users
          }
        }, function(error, html) {
          return response.send(html);
        });
      });
    });
  });
  app.get('/users/:id', function(request, response) {
    return db.collection('users', function(err, collection) {
      return collection.findOne({
        _id: request.params.id
      }, function(err, user) {
        return jade.renderFile('views/users/show.jade', {
          locals: {
            title: 'Buffsets.js - Users',
            user: user
          }
        }, function(error, html) {
          console.log(request.params.id);
          console.log(err);
          console.log(user);
          return response.send(html);
        });
      });
    });
  });
  port = process.env.PORT || 4000;
  app.listen(port, function() {
    return console.log("Listening on " + port);
  });
}).call(this);
