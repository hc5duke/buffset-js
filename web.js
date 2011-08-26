(function() {
  var Db, Server, app, connect, db, express, jade, mongo, openid, port, querystring, relyingParty, server, url;
  express = require('express');
  connect = require('connect');
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
  app.configure(function() {
    app.set('views', __dirname + '/views');
    return app.set('view engine', 'jade');
  });
  app.get('/', function(request, response, next) {
    return jade.renderFile('views/index.jade', {
      locals: {
        title: 'Tapjoy Buffsets.js'
      }
    }, function(error, html) {
      if (error) {
        next(error);
      }
      return response.send(html);
    });
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
  app.get('/users', function(request, response, next) {
    return db.collection('users', function(err, collection) {
      return collection.find({
        active: true
      }).toArray(function(err, users) {
        return jade.renderFile('views/users/index.jade', {
          locals: {
            title: 'Tapjoy Buffsets.js - Users',
            users: users
          }
        }, function(error, html) {
          if (error) {
            next(error);
          }
          return response.send(html);
        });
      });
    });
  });
  app.get('/users/:id', function(request, response, next) {
    return db.collection('users', function(err, collection) {
      return collection.find({
        _id: new db.bson_serializer.ObjectID(request.params.id)
      }).toArray(function(err, users) {
        return jade.renderFile('views/users/show.jade', {
          locals: {
            title: 'Tapjoy Buffsets.js - User ' + users[0].name,
            user: users[0]
          }
        }, function(error, html) {
          if (error) {
            next(error);
          }
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
