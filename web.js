(function() {
  var Db, Server, app, connect, db, dbHost, dbName, dbPass, dbPort, dbUser, express, helpers, jade, mongo, openid, port, querystring, relyingParty, server, url;
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
  app = express.createServer(express.logger());
  dbHost = 'localhost';
  dbPort = 27017;
  dbUser = '';
  dbPass = '';
  dbName = 'buffsets';
  app.configure('development', function() {
    app.use(express.static(__dirname + '/public'));
    return app.use(express.errorHandler({
      dumpExceptions: true,
      showStack: true
    }));
  });
  app.configure('production', function() {
    var arr, oneYear;
    oneYear = 31557600000;
    app.use(express.static(__dirname + '/public', {
      maxAge: oneYear
    }));
    app.use(express.errorHandler());
    arr = process.env.MONGOHQ_URL.split(/:|@|\//);
    dbUser = arr[3];
    dbPass = arr[4];
    dbHost = arr[5];
    dbPort = arr[6];
    return dbName = arr[7];
  });
  app.configure(function() {
    app.set('views', __dirname + '/views');
    return app.set('view engine', 'jade');
  });
  server = new Server(dbHost, dbPort, {
    auto_reconnect: true
  });
  db = new Db(dbName, server);
  db.open(function(err, db) {
    if (!err) {
      console.log("MongoDB connected");
      if (dbUser && dbPass) {
        return db.authenticate(dbUser, dbPass, function(err) {
          if (err) {
            return console.log(err);
          } else {
            return console.log("MongoDB authenticated");
          }
        });
      }
    } else {
      return console.log(err);
    }
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
  helpers = {
    tallyize: function(number) {
      return number * number;
    }
  };
  app.get('/users', function(request, response, next) {
    return db.collection('users', function(err, collection) {
      return collection.find({
        active: true
      }).toArray(function(err, users) {
        if (err) {
          next(err);
        }
        return jade.renderFile('views/users/index.jade', {
          locals: {
            title: 'Tapjoy Buffsets.js - Users',
            users: users,
            current_user: users[0],
            active_users_count: 2,
            users_count: 3,
            admin: true,
            helpers: helpers
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
