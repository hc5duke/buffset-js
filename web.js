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
    app.set('view engine', 'jade');
    return app.use(express.bodyParser());
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
    fives: function(num, unit, one, five, ten) {
      var c, i, ones, str;
      str = [];
      c = num / unit;
      if (c === 9) {
        str.push(one);
        str.push(ten);
        num -= 9 * unit;
      } else if (c >= 5) {
        str.push(five);
        num -= 5 * unit;
      } else if (c === 4) {
        str.push(one);
        str.push(five);
        num -= 4 * unit;
      }
      c = Math.floor(num / unit);
      if (c > 0) {
        ones = (function() {
          var _results;
          _results = [];
          for (i = 1; 1 <= c ? i <= c : i >= c; 1 <= c ? i++ : i--) {
            _results.push(one);
          }
          return _results;
        })();
        str.push(ones.join(''));
        num -= c * unit;
      }
      return [str.join(''), num];
    },
    romanize: function(number) {
      var arr, num, s, str;
      if (number > 3999) {
        return 'Inf';
      } else {
        str = [];
        num = number;
        arr = helpers.fives(num, 1000, 'M', '?', '?');
        s = arr[0];
        num = arr[1];
        str.push(s);
        arr = helpers.fives(num, 100, 'C', 'D', 'M');
        s = arr[0];
        num = arr[1];
        str.push(s);
        arr = helpers.fives(num, 10, 'X', 'L', 'C');
        s = arr[0];
        num = arr[1];
        str.push(s);
        return str.join('');
      }
    },
    tallyize: function(number) {
      var i, ones, slashes, str;
      if (number > 0) {
        ones = number % 10;
        str = [helpers.romanize(number - ones), ' '];
        if (ones >= 5) {
          str.push(String.fromCharCode(822, 47, 822, 47, 822, 47, 822, 47));
          str.push(' ');
          ones = ones - 5;
        }
        if (ones > 0) {
          slashes = (function() {
            var _results;
            _results = [];
            for (i = 1; 1 <= ones ? i <= ones : i >= ones; 1 <= ones ? i++ : i--) {
              _results.push('/');
            }
            return _results;
          })();
          str.push(slashes.join(''));
        }
        return str.join('').trim();
      } else {
        return "0";
      }
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
  app.post('/users/:id', function(request, response, next) {
    var user;
    user = {
      pushup_set_count: request.body.user.pushup_set_count
    };
    return db.collection('users', function(err, collection) {
      return collection.update({}, {
        $set: user
      }, {}, function(err) {
        return response.redirect('back');
      });
    });
  });
  port = process.env.PORT || 4000;
  app.listen(port, function() {
    return console.log("Listening on " + port);
  });
}).call(this);
