(function() {
  var Db, Pusher, RedisStore, Server, app, connect, db, dbHost, dbName, dbPass, dbPort, dbUser, express, extensions, helpers, jade, mongo, openid, port, pusher, pusherConfig, querystring, redis, relyingParty, renderWithLocals, server, url, withCurrentUser, withUserData, _;
  express = require('express');
  connect = require('connect');
  openid = require('openid');
  url = require('url');
  querystring = require('querystring');
  jade = require('jade');
  mongo = require('mongodb');
  redis = require('connect-redis');
  _ = require('underscore');
  Pusher = require('pusher');
  helpers = require('./lib/helpers');
  port = process.env.PORT || 4000;
  relyingParty = null;
  pusherConfig = (process.env.PUSHER_URL || '').split(/:|@|\//);
  pusher = new Pusher({
    appId: pusherConfig[7],
    appKey: pusherConfig[3],
    secret: pusherConfig[4]
  });
  extensions = [
    new openid.AttributeExchange({
      "http://axschema.org/contact/email": "required",
      "http://axschema.org/namePerson/first": "required",
      "http://axschema.org/namePerson/last": "required"
    })
  ];
  Server = mongo.Server;
  Db = mongo.Db;
  RedisStore = redis(express);
  app = express.createServer(express.logger());
  dbHost = 'localhost';
  dbPort = 27017;
  dbUser = '';
  dbPass = '';
  dbName = 'buffsets';
  app.configure(function() {
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.use(express.bodyParser());
    return app.use(express.cookieParser());
  });
  app.configure('development', function() {
    app.use(express.static(__dirname + '/public'));
    app.use(express.errorHandler({
      dumpExceptions: true,
      showStack: true
    }));
    app.use(express.session({
      secret: "keyboard cat",
      store: new RedisStore({
        maxAge: 24 * 60 * 60 * 1000
      })
    }));
    return relyingParty = new openid.RelyingParty('http://dev:' + port + '/verify', null, false, false, extensions);
  });
  app.configure('production', function() {
    var arr, oneYear, redisConfig;
    oneYear = 31557600000;
    app.use(express.static(__dirname + '/public', {
      maxAge: oneYear
    }));
    app.use(express.errorHandler());
    arr = (process.env.MONGOHQ_URL || '').split(/:|@|\//);
    dbUser = arr[3];
    dbPass = arr[4];
    dbHost = arr[5];
    dbPort = arr[6];
    dbName = arr[7];
    redisConfig = (process.env.REDISTOGO_URL || '').split(/:|@|\//);
    app.use(express.session({
      secret: "keyboard cat",
      store: new RedisStore({
        maxAge: 90 * 24 * 60 * 60 * 1000,
        pass: redisConfig[4],
        host: redisConfig[5],
        port: redisConfig[6]
      })
    }));
    return relyingParty = new openid.RelyingParty('https://buffsets.tapjoy.com:' + port + '/verify', null, false, false, extensions);
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
  withCurrentUser = function(db, userId, callback) {
    var id;
    id = new db.bson_serializer.ObjectID(userId);
    return db.collection('users', function(error, users) {
      if (error) {
        return callback(error);
      } else {
        return users.findOne({
          _id: id
        }, function(error, currentUser) {
          return callback(error, currentUser || false);
        });
      }
    });
  };
  withUserData = function(users, callback) {
    return users.count({
      active: true
    }, function(error, activeUsersCount) {
      if (!error) {
        return users.count({}, function(error, usersCount) {
          if (!error) {
            return callback(null, {
              activeUsersCount: activeUsersCount,
              usersCount: usersCount
            });
          } else {
            return callback(error);
          }
        });
      } else {
        return callback(error);
      }
    });
  };
  renderWithLocals = function(locals, view, callback) {
    return db.collection('users', function(error, users) {
      return withUserData(users, function(error, userData) {
        if (!error) {
          locals = _.extend(locals, {
            active_users_count: userData.activeUsersCount,
            users_count: userData.usersCount,
            helpers: helpers
          });
          view = 'views/' + view + '.jade';
          return jade.renderFile(view, {
            locals: locals
          }, callback);
        } else {
          return callback(error);
        }
      });
    });
  };
  app.get('/', function(request, response, next) {
    return withCurrentUser(db, request.session.userId, function(error, currentUser) {
      var locals;
      if (currentUser) {
        return response.redirect('/users/');
      } else {
        if (error) {
          next(error);
        }
        locals = {
          title: 'Tapjoy Buffsets.js',
          currentUser: currentUser
        };
        return renderWithLocals(locals, 'index', function(error, html) {
          if (error) {
            next(error);
          }
          return response.send(html);
        });
      }
    });
  });
  app.get('/services/signout', function(request, response, next) {
    helpers.logOut(request.session);
    return response.redirect('/');
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
        response.writeHead(302, {
          Location: authUrl
        });
        return response.end();
      }
    });
  });
  app.get('/verify', function(request, response, next) {
    return relyingParty.verifyAssertion(request, function(error, result) {
      if (error || !result.authenticated) {
        response.send('Failure :(');
        return;
      }
      return db.collection('users', function(err, users) {
        var service, user;
        service = helpers.newService(result);
        return user = users.findOne({
          'services.uid': service.uid
        }, function(err, user) {
          if (user) {
            helpers.logIn(user, request.session);
            return response.redirect('/users/');
          } else {
            return users.findOne({
              email: result.email
            }, function(err, user) {
              if (err) {
                next(err);
              }
              if (user) {
                if (!user.services) {
                  user.services = [];
                }
                user.services.push(service);
                users.update({
                  _id: user._id
                }, {
                  $push: {
                    services: service
                  }
                }, false, false);
                return response.redirect('/users/' + user._id);
              } else {
                user = helpers.newUser(result);
                users.insert(user);
                return response.send("new user created");
              }
            });
          }
        });
      });
    });
  });
  app.get('/users', function(request, response, next) {
    return db.collection('users', function(error, users) {
      return users.find({
        active: true
      }).toArray(function(error, users) {
        if (error) {
          next(error);
        }
        return withCurrentUser(db, request.session.userId, function(error, currentUser) {
          var locals;
          if (error) {
            next(error);
          }
          locals = {
            title: 'Tapjoy Buffsets.js - Users',
            users: users,
            currentUser: currentUser
          };
          return renderWithLocals(locals, 'users/index', function(error, html) {
            if (error) {
              next(error);
            }
            return response.send(html);
          });
        });
      });
    });
  });
  app.get('/users/:id', function(request, response, next) {
    return db.collection('users', function(error, users) {
      var id;
      if (error) {
        next(error);
      }
      id = new db.bson_serializer.ObjectID(request.params.id);
      return users.findOne({
        _id: id
      }, function(error, user) {
        if (error) {
          next(error);
        }
        return withCurrentUser(db, request.session.userId, function(error, currentUser) {
          var locals;
          if (error) {
            next(error);
          }
          locals = {
            title: 'Tapjoy Buffsets.js - User ' + user.name,
            user: user,
            currentUser: currentUser
          };
          return renderWithLocals(locals, 'users/show', function(error, html) {
            if (error) {
              next(error);
            }
            return response.send(html);
          });
        });
      });
    });
  });
  app.get('/users/:id/edit', function(request, response, next) {
    return db.collection('users', function(error, users) {
      var id;
      if (error) {
        next(error);
      }
      id = new db.bson_serializer.ObjectID(request.params.id);
      return users.findOne({
        _id: id
      }, function(error, user) {
        if (error) {
          next(error);
        }
        return withCurrentUser(db, request.session.userId, function(error, currentUser) {
          var locals;
          if (error) {
            next(error);
          }
          locals = {
            title: 'Tapjoy Buffsets.js - User ' + user.name,
            user: user,
            currentUser: currentUser
          };
          return renderWithLocals(locals, 'users/show', function(error, html) {
            if (error) {
              next(error);
            }
            return response.send(html);
          });
        });
      });
    });
  });
  app.listen(port, function() {
    return console.log("Listening on " + port);
  });
}).call(this);
