(function() {
  var Buffset, Db, Helpers, Pusher, RedisStore, Server, User, app, authorizedToEdit, buffsetTypes, conRedis, connect, db, dbHost, dbName, dbPass, dbPort, dbUser, express, extension, jade, mongo, nodeEnv, openid, port, pusher, pusherChannel, pusherConfig, querystring, redis, redisClient, redisConfig, relyingParty, renderWithLocals, server, teamNames, url, verifyUrl, _;
  express = require('express');
  connect = require('connect');
  openid = require('openid');
  url = require('url');
  querystring = require('querystring');
  jade = require('jade');
  mongo = require('mongodb');
  Server = mongo.Server;
  Db = mongo.Db;
  redis = require('redis');
  conRedis = require('connect-redis');
  RedisStore = conRedis(express);
  _ = require('underscore');
  Pusher = require('node-pusher');
  Helpers = require('./lib/helpers');
  User = require('./lib/user');
  Buffset = require('./lib/buffset');
  port = process.env.PORT || 4000;
  app = express.createServer(express.logger());
  verifyUrl = 'https://buffsets.tapjoy.com/verify';
  extension = new openid.AttributeExchange({
    "http://axschema.org/contact/email": "required",
    "http://axschema.org/namePerson/first": "required",
    "http://axschema.org/namePerson/last": "required"
  });
  pusherChannel = 'tapjoy_channel';
  pusherConfig = [];
  pusherConfig[7] = '7999';
  pusherConfig[3] = '9e3138091756a4f921d0';
  pusherConfig[4] = '584c00ebe3703b0df7c1';
  if (process.env.PUSHER_URL) {
    pusherConfig = process.env.PUSHER_URL.split(/:|@|\//);
  }
  pusher = new Pusher({
    appId: pusherConfig[7],
    key: pusherConfig[3],
    secret: pusherConfig[4]
  });
  dbHost = 'localhost';
  dbPort = 27017;
  dbUser = '';
  dbPass = '';
  dbName = 'buffsets';
  teamNames = [process.env.TEAM_1_NAME || 'Amir', process.env.TEAM_2_NAME || 'Johnny'];
  buffsetTypes = ['pushup', 'situp', 'lunge', 'pullup', 'wallsits', 'plank'];
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
    verifyUrl = 'http://localhost:' + port + '/verify';
    return User.withCurrentUser = function(session, callback) {
      return User.findOne({}, callback);
    };
  });
  redisConfig = false;
  nodeEnv = 'development';
  app.configure('production', function() {
    var oneYear, x, _ref;
    nodeEnv = 'production';
    oneYear = 31557600000;
    app.use(express.static(__dirname + '/public', {
      maxAge: oneYear
    }));
    app.use(express.errorHandler());
    _ref = (process.env.MONGOHQ_URL || '').split(/:|@|\//), x = _ref[0], x = _ref[1], x = _ref[2], dbUser = _ref[3], dbPass = _ref[4], dbHost = _ref[5], dbPort = _ref[6], dbName = _ref[7];
    redisConfig = (process.env.REDISTOGO_URL || '').split(/:|@|\//);
    return app.use(express.session({
      secret: "keyboard cat",
      store: new RedisStore({
        maxAge: oneYear,
        pass: redisConfig[4],
        host: redisConfig[5],
        port: redisConfig[6]
      })
    }));
  });
  if (redisConfig) {
    redisClient = redis.createClient(redisConfig[6], redisConfig[5]);
    redisClient.auth(redisConfig[4], function(error, result) {
      if (error) {
        return console.log(error);
      }
    });
  } else {
    redisClient = redis.createClient();
  }
  relyingParty = new openid.RelyingParty(verifyUrl, null, false, false, [extension]);
  server = new Server(dbHost, dbPort, {
    auto_reconnect: true
  });
  db = new Db(dbName, server);
  User.setDb(db);
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
  renderWithLocals = function(locals, view, next, response) {
    return User.withCounts(function(userData) {
      locals = _.extend(locals, {
        activeUsersCount: userData.activeCount,
        usersCount: userData.count,
        nodeEnv: nodeEnv,
        Helpers: Helpers
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
    });
  };
  authorizedToEdit = function(currentUser, authorizedUserId, adminOnly) {
    return currentUser.admin || (!adminOnly && authorizedUserId === String(currentUser._id));
  };
  app.get('/', function(request, response, next) {
    return User.withCurrentUser(request.session, function(currentUser) {
      var locals;
      if (currentUser) {
        return response.redirect('/users/');
      } else {
        locals = {
          title: 'Tapjoy Buffsets.js',
          currentUser: currentUser
        };
        return renderWithLocals(locals, 'index', next, response);
      }
    });
  });
  app.get('/services/signout', function(request, response, next) {
    request.session.userId = null;
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
      var service;
      if (error || !result.authenticated) {
        console.log(error, result);
        return response.send('Failure :(');
      }
      service = User.newService(result);
      return User.findOne({
        'services.uid': service.uid
      }, function(user) {
        var callback;
        if (user) {
          user.logIn(request.session);
          return response.redirect('/users/');
        } else {
          callback = function(user) {
            user.logIn(request.session);
            return response.redirect('/users/' + user._id + '/edit');
          };
          return User.findOne({
            email: result.email
          }, function(user) {
            if (user) {
              return user.update({
                service: service
              }, true, function() {
                return callback(user);
              });
            } else {
              return User.create(result, service, callback);
            }
          });
        }
      });
    });
  });
  app.get('/users', function(request, response, next) {
    return User.findAll({
      active: true
    }, {}, function(allUsers) {
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
      return User.withCurrentUser(request.session, function(currentUser) {
        var locals, members, scores, teams;
        scores = [0, 0];
        members = _.groupBy(allUsers, function(user) {
          scores[user.team] += user.buffsets.length;
          return user.team;
        });
        teams = [
          {
            name: teamNames[0],
            score: scores[0],
            users: members[0],
            order: 0
          }, {
            name: teamNames[1],
            score: scores[1],
            users: members[1],
            order: 1
          }
        ];
        locals = {
          title: 'Users',
          teams: teams,
          currentUser: currentUser
        };
        return renderWithLocals(locals, 'users/index', next, response);
      });
    });
  });
  app.get('/statz', function(request, response, next) {
    return User.withCurrentUser(request.session, function(currentUser) {
      var callback, key, timeframe, timeframeText;
      if (!currentUser) {
        return response.redirect('/users/');
      }
      timeframe = request.query.timeframe;
      if (timeframe === '7') {
        timeframeText = 'last 7 days';
      } else if (timeframe === '24') {
        timeframeText = 'last 24 hours';
      } else {
        timeframe = '3';
        timeframeText = 'season 3';
      }
      callback = function(locals) {
        locals.title = 'Statz';
        locals.currentUser = currentUser;
        return renderWithLocals(locals, 'statz', next, response);
      };
      key = "statz." + timeframe;
      return redisClient.get(key, function(err, locals) {
        if (locals) {
          return callback(JSON.parse(locals));
        } else {
          return db.collection('buffsets', function(error, buffsets) {
            var conditions, init, reduce;
            conditions = {};
            if (timeframe === '7') {
              conditions.created_at = {
                $gt: new Date(new Date() - 7 * 24 * 3600 * 1000)
              };
            }
            if (timeframe === '24') {
              conditions.created_at = {
                $gt: new Date(new Date() - 24 * 3600 * 1000)
              };
            }
            init = {
              total: 0,
              pushup: 0,
              situp: 0,
              lunge: 0,
              pullup: 0,
              wallsits: 0,
              plank: 0,
              global: {
                total: 0,
                pushup: 0,
                situp: 0,
                lunge: 0,
                pullup: 0,
                wallsits: 0,
                plank: 0
              }
            };
            reduce = function(doc, out) {
              out.total++;
              out[doc.type]++;
              out.global.total++;
              return out.global[doc.type]++;
            };
            return buffsets.group({
              user_id: true
            }, conditions, init, reduce, function(error, statz) {
              var max;
              statz = _.sortBy(statz, function(stat) {
                return -stat.total;
              });
              max = {
                total: 0,
                pushup: 0,
                situp: 0,
                lunge: 0,
                pullup: 0,
                wallsits: 0,
                plank: 0
              };
              _.each(statz, function(stat) {
                if (stat.total > max.total) {
                  max.total = stat.total;
                }
                return _.each(buffsetTypes, function(type) {
                  if (stat[type] > max[type]) {
                    return max[type] = stat[type];
                  }
                });
              });
              return User.findAll({
                active: true
              }, {}, function(allUsers) {
                var usersHash;
                usersHash = {};
                _.each(allUsers, function(user) {
                  var u;
                  u = {
                    _id: String(user._id),
                    handle: user.handle,
                    name: user.name,
                    team: teamNames[user.team],
                    gender: user.female ? 'female' : 'male'
                  };
                  return usersHash[user._id] = u;
                });
                locals = {
                  usersHash: usersHash,
                  timeframe: timeframe,
                  timeframeText: timeframeText,
                  statz: statz,
                  max: max,
                  updatedAt: new Date()
                };
                callback(locals);
                redisClient.set(key, JSON.stringify(locals));
                return redisClient.expire(key, 60);
              });
            });
          });
        }
      });
    });
  });
  app.get('/users/:id', function(request, response, next) {
    return response.redirect("/users/" + request.params.id + "/buffsets");
  });
  app.get('/users/:id/buffsets', function(request, response, next) {
    return User.findOne({
      _id: request.params.id
    }, function(user) {
      if (!user) {
        return response.redirect('/users');
      }
      return User.withCurrentUser(request.session, function(currentUser) {
        var locals;
        locals = {
          title: 'Competitive Chartz',
          currentUser: currentUser,
          user: user,
          series: [user.buffsetData()],
          pieData: {
            size: 1,
            data: user.buffsetPieData()
          }
        };
        return renderWithLocals(locals, 'chartz/competitive', next, response);
      });
    });
  });
  app.get('/users/:id/edit', function(request, response, next) {
    return User.withCurrentUser(request.session, function(currentUser) {
      if (authorizedToEdit(currentUser, request.params.id)) {
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
              currentUser: currentUser,
              teamNames: teamNames
            };
            return renderWithLocals(locals, 'users/edit', next, response);
          });
        });
      } else {
        return response.redirect('/users/' + request.params.id);
      }
    });
  });
  app.get('/admin/users', function(request, response, next) {
    return User.withCurrentUser(request.session, function(currentUser) {
      var userOrder;
      if (authorizedToEdit(currentUser, '', true)) {
        userOrder = {
          team: 1,
          name: 1
        };
        return User.findAll({
          active: true
        }, {
          order: userOrder
        }, function(activeUsers) {
          return User.findAll({
            active: {
              $ne: true
            }
          }, {
            order: userOrder
          }, function(inactiveUsers) {
            var locals;
            locals = {
              title: 'Users',
              activeUsers: activeUsers,
              inactiveUsers: inactiveUsers,
              currentUser: currentUser,
              teamNames: teamNames
            };
            return renderWithLocals(locals, 'admin/users/index', next, response);
          });
        });
      } else {
        return response.redirect('/users');
      }
    });
  });
  app.post('/users/:id', function(request, response, next) {
    return User.withCurrentUser(request.session, function(currentUser) {
      if (authorizedToEdit(currentUser, request.params.id)) {
        return currentUser.update(request.body.user, false, function(error) {
          return response.redirect('/users');
        });
      } else {
        return response.redirect('back');
      }
    });
  });
  app.post('/users/:id/buffsets/create', function(request, response, next) {
    return User.withCurrentUser(request.session, function(currentUser) {
      if (authorizedToEdit(currentUser, request.params.id)) {
        return Buffset.create(request.params.id, request.body.user.buffset_type, function() {
          currentUser.pusherData(+1, function(data) {
            return pusher.trigger(pusherChannel, 'buffset', data);
          });
          return response.redirect('/users');
        });
      } else {
        return response.redirect('back');
      }
    });
  });
  app.post('/admin/users/:id', function(request, response, next) {
    return User.withCurrentUser(request.session, function(currentUser) {
      if (!currentUser.admin) {
        return response.redirect('/users');
      }
      return User.findOne(request.params.id, function(user) {
        return user.update(request.body.user, true, function(error) {
          return response.redirect('back');
        });
      });
    });
  });
  app.get('/chartz', function(request, response, next) {
    return User.withCurrentUser(request.session, function(currentUser) {
      return User.withChartableUsers(function(activeUsers) {
        var callback, key;
        key = "chartz.individual";
        callback = function(series) {
          var locals;
          locals = {
            title: 'Competitive Chartz',
            activeUsers: activeUsers,
            currentUser: currentUser,
            series: series,
            pieData: {
              size: 1,
              data: User.combinedBuffsetPieData(activeUsers)
            }
          };
          return renderWithLocals(locals, 'chartz/competitive', next, response);
        };
        return redisClient.get(key, function(err, series) {
          if (series) {
            return callback(JSON.parse(series));
          } else {
            series = _.map(activeUsers, function(user) {
              return user.buffsetData();
            });
            redisClient.set(key, JSON.stringify(series));
            redisClient.expire(key, 60);
            return callback(series);
          }
        });
      });
    });
  });
  app.get('/chartz/team', function(request, response, next) {
    return User.withCurrentUser(request.session, function(currentUser) {
      return User.withChartableUsers(function(activeUsers) {
        var index, locals, series, teams;
        teams = _.groupBy(activeUsers, function(user) {
          return user.team;
        });
        index = -1;
        series = _.map(teams, function(team) {
          var buffsets, currentCount, data;
          buffsets = _.map(team, function(user) {
            return user.buffsets;
          });
          buffsets = _.flatten(buffsets);
          buffsets = _.sortBy(buffsets, function(buffset) {
            return buffset.created_at;
          });
          currentCount = 0;
          data = _.map(buffsets, function(buffset) {
            currentCount += 1;
            return [buffset.created_at, currentCount];
          });
          index++;
          return {
            name: teamNames[index],
            data: data
          };
        });
        locals = {
          title: 'Competitive Chartz',
          activeUsers: activeUsers,
          currentUser: currentUser,
          series: series,
          pieData: {
            size: 2,
            teamNames: teamNames,
            data: [User.combinedBuffsetPieData(teams[0]), User.combinedBuffsetPieData(teams[1])]
          }
        };
        return renderWithLocals(locals, 'chartz/competitive', next, response);
      });
    });
  });
  app.get('/chartz/sum', function(request, response, next) {
    return User.withCurrentUser(request.session, function(currentUser) {
      return User.withChartableUsers(function(activeUsers) {
        var buffsets, data, date, dates, earliest, latest, locals;
        earliest = Infinity;
        latest = 0;
        buffsets = {};
        _.each(activeUsers, function(user) {
          return buffsets[user.handle] = {};
        });
        _.each(activeUsers, function(user) {
          return _.each(user.buffsets, function(buffset) {
            var created_at, _base;
            created_at = Helpers.endOfDay(buffset.created_at);
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
  app.get('/chartz/punch', function(request, response, next) {
    return User.withCurrentUser(request.session, function(currentUser) {
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
