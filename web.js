(function() {
  var Db, Pusher, RedisStore, Server, app, authorizedToEdit, channel, connect, db, dbHost, dbName, dbPass, dbPort, dbUser, event, express, extensions, helpers, jade, mongo, openid, port, pusher, pusherConfig, querystring, redis, relyingParty, renderWithLocals, server, url, withCurrentUser, withUserData, _;
  express = require('express');
  connect = require('connect');
  openid = require('openid');
  url = require('url');
  querystring = require('querystring');
  jade = require('jade');
  mongo = require('mongodb');
  redis = require('connect-redis');
  _ = require('underscore');
  Pusher = require('node-pusher');
  helpers = require('./lib/helpers');
  port = process.env.PORT || 4000;
  relyingParty = null;
  pusher = null;
  if (process.env.PUSHER_URL) {
    pusherConfig = process.env.PUSHER_URL.split(/:|@|\//);
    pusher = new Pusher({
      appId: pusherConfig[7],
      key: pusherConfig[3],
      secret: pusherConfig[4]
    });
  } else {
    console.log("WARNING: no Pusher");
  }
  channel = 'test_channel';
  event = 'my_event';
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
  withCurrentUser = function(session, callback) {
    var id;
    id = new db.bson_serializer.ObjectID(session.userId);
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
  renderWithLocals = function(locals, view, next, response) {
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
          }, function(error, html) {
            if (error) {
              return next(error);
            } else {
              return response.send(html);
            }
          });
        } else {
          return next(error);
        }
      });
    });
  };
  authorizedToEdit = function(currentUser, request, adminOnly) {
    return currentUser.admin || (!adminOnly && request.params.id === String(currentUser._id));
  };
  app.get('/', function(request, response, next) {
    return withCurrentUser(request.session, function(error, currentUser) {
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
        return renderWithLocals(locals, 'index', next, response);
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
                user.services || (user.services = []);
                users.update({
                  _id: user._id
                }, {
                  $push: {
                    services: service
                  }
                }, false, false);
              } else {
                user = helpers.newUser(result);
                users.insert(user);
              }
              helpers.logIn(user, request.session);
              return response.redirect('/users/' + user._id + '/edit');
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
      }).toArray(function(error, allUsers) {
        if (error) {
          next(error);
        }
        return withCurrentUser(request.session, function(error, currentUser) {
          var locals;
          if (error) {
            next(error);
          }
          locals = {
            title: 'Users',
            users: allUsers,
            currentUser: currentUser
          };
          return renderWithLocals(locals, 'users/index', next, response);
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
        return withCurrentUser(request.session, function(error, currentUser) {
          var locals;
          if (error) {
            next(error);
          }
          locals = {
            title: 'User ' + user.name,
            user: user,
            currentUser: currentUser
          };
          return renderWithLocals(locals, 'users/show', next, response);
        });
      });
    });
  });
  app.get('/users/:id/edit', function(request, response, next) {
    return withCurrentUser(request.session, function(error, currentUser) {
      if (error) {
        next(error);
      }
      if (authorizedToEdit(currentUser, request)) {
        return db.collection('users', function(error, users) {
          var id;
          if (error) {
            next(error);
          }
          id = new db.bson_serializer.ObjectID(request.params.id);
          return users.findOne({
            _id: id
          }, function(error, user) {
            var locals;
            if (error) {
              next(error);
            }
            locals = {
              title: 'User ' + user.name,
              user: user,
              currentUser: currentUser
            };
            return renderWithLocals(locals, 'users/edit', next, response);
          });
        });
      } else {
        return response.redirect('/users/' + request.params.id);
      }
    });
  });
  app.post('/users/:id', function(request, response, next) {
    return withCurrentUser(request.session, function(error, currentUser) {
      var id, userHash, userParams;
      if (error) {
        next(error);
      }
      if (authorizedToEdit(currentUser, request)) {
        userParams = request.body.user;
        userHash = {};
        if (userParams.handle) {
          userHash.handle = userParams.handle;
        }
        userHash.abuse = userParams.abuse !== '0';
        id = new db.bson_serializer.ObjectID(request.params.id);
        return db.collection('users', function(error, users) {
          var buffset, options, updates;
          if (error) {
            next(error);
          }
          updates = {
            $set: userHash
          };
          if (userParams.buffset_type) {
            buffset = helpers.newBuffset(request.params.id, userParams.buffset_type);
            updates['$push'] = {
              buffsets: buffset
            };
            if (pusher) {
              users.findOne({
                _id: id
              }, function(error, user) {
                var userData;
                userData = {
                  id: user._id,
                  buffsets: helpers.tallyize(user.buffsets.length + 1)
                };
                return pusher.trigger(channel, event, userData);
              });
            }
          }
          options = {
            safe: true,
            multi: false,
            upsert: false
          };
          return users.update({
            _id: id
          }, updates, options, function(error) {
            if (error) {
              next(error);
            }
            return response.redirect('back');
          });
        });
      } else {
        return response.redirect('/users/' + request.params.id);
      }
    });
  });
  app.get('/admin/users', function(request, response, next) {
    return withCurrentUser(request.session, function(error, currentUser) {
      if (error) {
        next(error);
      }
      if (authorizedToEdit(currentUser, request)) {
        return db.collection('users', function(error, users) {
          return users.find({
            active: {
              $ne: true
            }
          }).toArray(function(error, inactiveUsers) {
            if (error) {
              next(error);
            }
            return users.find({
              active: true
            }).toArray(function(error, activeUsers) {
              var locals;
              if (error) {
                next(error);
              }
              locals = {
                title: 'Users',
                activeUsers: activeUsers,
                inactiveUsers: inactiveUsers,
                currentUser: currentUser
              };
              return renderWithLocals(locals, 'admin/users/index', next, response);
            });
          });
        });
      }
    });
  });
  app.post('/admin/users/:id', function(request, response, next) {
    return withCurrentUser(request.session, function(error, currentUser) {
      var id, userHash, userParams;
      if (error) {
        next(error);
      }
      if (currentUser.admin) {
        userParams = request.body.user;
        userHash = {};
        userHash.active = userParams.active !== '0';
        userHash.name = userParams.name;
        userHash.handle = userParams.handle;
        id = new db.bson_serializer.ObjectID(request.params.id);
        return db.collection('users', function(error, users) {
          var options;
          if (error) {
            next(error);
          }
          options = {
            safe: true,
            multi: false,
            upsert: false
          };
          return users.update({
            _id: id
          }, {
            $set: userHash
          }, options, function(error) {
            if (error) {
              next(error);
            }
            return response.redirect('back');
          });
        });
      } else {
        return response.redirect('/admin/users');
      }
    });
  });
  app.get('/chartz', function(request, response, next) {
    return withCurrentUser(request.session, function(error, currentUser) {
      return db.collection('users', function(error, users) {
        return users.find({
          active: true
        }).toArray(function(error, activeUsers) {
          var locals, series;
          series = _.map(activeUsers, function(user) {
            var currentCount, data;
            if (user.buffsets.length > 0) {
              currentCount = -1;
              data = _.map(user.buffsets, function(buffset) {
                currentCount += 1;
                return [buffset.created_at, currentCount];
              });
              return {
                name: user.handle,
                data: data,
                multiplier: user.multiplier
              };
            }
          });
          locals = {
            title: 'Competitive Chartz',
            activeUsers: activeUsers,
            currentUser: currentUser,
            series: series
          };
          return renderWithLocals(locals, 'chartz/competitive', next, response);
        });
      });
    });
  });
  app.get('/chartz/sum', function(request, response, next) {});
  app.get('/chartz/punch', function(request, response, next) {});
  app.listen(port, function() {
    return console.log("Listening on " + port);
  });
}).call(this);
