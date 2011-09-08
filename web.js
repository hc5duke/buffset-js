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
    var oneYear;
    oneYear = 31557600000;
    app.use(express.static(__dirname + '/public'));
    app.use(express.errorHandler({
      dumpExceptions: true,
      showStack: true
    }));
    app.use(express.session({
      secret: "keyboard cat",
      store: new RedisStore({
        maxAge: oneYear
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
        maxAge: oneYear,
        pass: redisConfig[4],
        host: redisConfig[5],
        port: redisConfig[6]
      })
    }));
    return relyingParty = new openid.RelyingParty('https://buffsets.tapjoy.com/verify', null, false, false, extensions);
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
              var email, is_tapjoy;
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
                email = user.email;
                is_tapjoy = email.match(/@tapjoy\.com$/ != null ? /@tapjoy\.com$/ : {
                  "true": false
                });
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
        allUsers = _.groupBy(allUsers, function(user) {
          return user.buffsets.length;
        });
        allUsers = _.map(allUsers, function(users) {
          users = _.sortBy(users, function(user) {
            return user.handle.toLowerCase();
          });
          return users.reverse();
        });
        allUsers = _.flatten(allUsers).reverse();
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
          var currentCount, data, locals, series;
          if (error) {
            next(error);
          }
          series = [];
          if (user.buffsets.length > 0) {
            currentCount = -1;
            data = _.map(user.buffsets, function(buffset) {
              currentCount += 1;
              return [buffset.created_at, currentCount];
            });
            series = [
              {
                name: user.handle,
                data: data,
                multiplier: user.multiplier
              }
            ];
          }
          locals = {
            title: 'Competitive Chartz',
            currentUser: currentUser,
            series: series
          };
          return renderWithLocals(locals, 'chartz/competitive', next, response);
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
                var count, tally, userData;
                count = user.buffsets.length + 1;
                tally = helpers.tallyize(count);
                userData = {
                  id: user._id,
                  name: user.name,
                  count: count,
                  tally: tally
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
            return response.redirect('/users');
          });
        });
      } else {
        return response.redirect('back');
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
      } else {
        return response.redirect('/users');
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
        return response.redirect('/users');
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
          activeUsers = _.select(activeUsers, function(user) {
            return user.buffsets.length > 0;
          });
          activeUsers = _.sortBy(activeUsers, function(user) {
            return -user.buffsets.length;
          });
          series = _.map(activeUsers, function(user) {
            var currentCount, data;
            if (user.buffsets.length > 0) {
              currentCount = 0;
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
  app.get('/chartz/sum', function(request, response, next) {
    return withCurrentUser(request.session, function(error, currentUser) {
      return db.collection('users', function(error, users) {
        return users.find({
          active: true
        }).toArray(function(error, activeUsers) {
          var buffsets, data, date, dates, earliest, latest, locals;
          activeUsers = _.select(activeUsers, function(user) {
            return user.buffsets.length > 0;
          });
          activeUsers = _.sortBy(activeUsers, function(user) {
            return -user.buffsets.length;
          });
          earliest = Infinity;
          latest = 0;
          buffsets = {};
          _.each(activeUsers, function(user) {
            return buffsets[user.handle] = {};
          });
          _.each(activeUsers, function(user) {
            return _.each(user.buffsets, function(buffset) {
              var created_at, _base;
              created_at = helpers.endOfDay(buffset.created_at);
              (_base = buffsets[user.handle])[created_at] || (_base[created_at] = 0);
              buffsets[user.handle][created_at] += 1;
              if (latest < created_at) {
                latest = created_at;
              }
              if (earliest > created_at) {
                return earliest = created_at;
              }
            });
          });
          date = earliest;
          dates = [];
          while (date <= latest) {
            dates.push(date);
            date = new Date(date - 0 + 24 * 3600 * 1000);
          }
          _.each(activeUsers, function(user) {
            var arr, sum;
            sum = 0;
            arr = [];
            _.each(dates, function(date) {
              var _base;
              (_base = buffsets[user.handle])[date] || (_base[date] = 0);
              sum += buffsets[user.handle][date];
              return arr.push(sum);
            });
            return buffsets[user.handle] = arr;
          });
          data = [];
          _.each(buffsets, function(value, key) {
            var counts;
            counts = _.map(value, function(count, date) {
              return count;
            });
            return data.push({
              name: key,
              data: counts
            });
          });
          dates = _.map(dates, function(date) {
            return [1 + date.getMonth(), '/', date.getDate()].join('');
          });
          locals = {
            title: 'Tapjoy Buffsets.js',
            currentUser: currentUser,
            series: data,
            categories: dates
          };
          return renderWithLocals(locals, 'chartz/cumulative', next, response);
        });
      });
    });
  });
  app.get('/chartz/punch', function(request, response, next) {
    return withCurrentUser(request.session, function(error, currentUser) {
      return db.collection('users', function(error, users) {
        return users.find({
          active: true
        }).toArray(function(error, activeUsers) {
          var chart_url, data, days, hours, locals, max, weekday, weekdays;
          days = [];
          _.each(_.range(7), function(day) {
            days[day] = [];
            return _.each(_.range(24), function(hour) {
              return days[day][hour] = 0;
            });
          });
          activeUsers = _.select(activeUsers, function(user) {
            return _.each(user.buffsets, function(buffset) {
              var created_at;
              created_at = buffset.created_at;
              return days[created_at.getDay()][created_at.getHours()] += 1;
            });
          });
          data = _.flatten(days.slice(1, -1));
          max = _.max(data);
          _.times(24, function() {
            return data.push('0');
          });
          hours = [];
          weekdays = [];
          weekday = 0;
          _.times(5, function() {
            var range;
            range = _.range(24).join(',');
            hours.push(range);
            _.times(24, function() {
              return weekdays.push(weekday);
            });
            return weekday += 1;
          });
          chart_url = ['https://chart.googleapis.com/chart?chs=800x300&chds=-1,24,-1,5,0,', max, '&chf=bg,s,efefef&chd=t:', hours.join(','), '|', weekdays.join(','), '|', data.join(','), "&chxt=x,y&chm=o,333333,1,1.0,25.0&chxl=0:||12am|1|2|3|4|5|6|7|8|9|10|11|12pm|1|2|3|4|5|6|7|8|9|10|11||1:|", "|Mon|Tue|Wed|Thr|Fri|&cht=s"].join('');
          locals = {
            title: 'Tapjoy Buffsets.js',
            currentUser: currentUser,
            chart_url: chart_url
          };
          return renderWithLocals(locals, 'chartz/punchcard', next, response);
        });
      });
    });
  });
  app.listen(port, function() {
    return console.log("Listening on " + port);
  });
}).call(this);
