(function() {
  var Buffset, User, _;
  _ = require('underscore');
  Buffset = require('./buffset');
  User = (function() {
    function User(user) {
      this._id = user._id;
      this.createdAt = user.created_at;
      this.active = !!user.active;
      this.admin = !!user.admin;
      this.female = !!user.female;
      this.abuse = !!user.abuse;
      this.email = String(user.email);
      this.handle = String(user.handle);
      this.name = String(user.name);
      this.buffsets = user.buffsets || [];
      this.services = user.services || [];
      this.team = Number(user.team || 0);
    }
    User.prototype.buffsetData = function() {
      var currentCount, data;
      currentCount = 0;
      data = _.map(this.buffsets, function(buffset) {
        currentCount += 1;
        return [buffset.created_at, currentCount];
      });
      return {
        name: this.handle,
        data: data
      };
    };
    User.prototype.buffsetPieData = function() {
      return User.buffsetPieData(this.buffsets);
    };
    User.prototype.tally = function(offset) {
      var fiveTally, fives, i, number, ones, romanize, slashes, str;
      fives = function(num, unit, one, five, ten) {
        var c, i, ones, str;
        str = [];
        c = num / unit;
        if (c === 9) {
          str.push(one, ten);
          num -= 9 * unit;
        } else if (c >= 5) {
          str.push(five);
          num -= 5 * unit;
        } else if (c === 4) {
          str.push(one, five);
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
      };
      romanize = function(num) {
        var n, s, str, _ref, _ref2, _ref3;
        if (num > 3999) {
          return 'Inf';
        }
        str = [];
        _ref = fives(num, 1000, 'M', '?', '?'), s = _ref[0], n = _ref[1];
        str.push(s);
        _ref2 = fives(n, 100, 'C', 'D', 'M'), s = _ref2[0], n = _ref2[1];
        str.push(s);
        _ref3 = fives(n, 10, 'X', 'L', 'C'), s = _ref3[0], n = _ref3[1];
        str.push(s);
        return str.join('');
      };
      number = this.buffsets.length + (offset || 0);
      if (number > 0) {
        ones = number % 10;
        str = [romanize(number - ones), ' '];
        if (ones >= 5) {
          fiveTally = String.fromCharCode(822, 47, 822, 47, 822, 47, 822, 47);
          str.push(fiveTally, ' ');
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
    };
    User.prototype.pusherData = function(offset, callback) {
      var data;
      data = {
        id: this._id,
        name: this.name,
        count: this.buffsets.length + offset,
        tally: this.tally(offset),
        team: this.team,
        teamScore: 0
      };
      return User.findAll({
        active: true,
        team: this.team
      }, function(allUsers) {
        _.each(allUsers, function(user) {
          return data.teamScore += user.buffsets.length;
        });
        return callback(data);
      });
    };
    User.prototype.update = function(options, admin, callback) {
      var conditions, handle, team, updates;
      conditions = {
        _id: this._id
      };
      updates = {
        $set: {},
        $push: {}
      };
      if (options.abuse != null) {
        updates.$set.abuse = options.abuse !== '0';
      }
      if (options.female != null) {
        updates.$set.female = options.female !== '0';
      }
      if (options.handle) {
        handle = options.handle;
        updates.$set.handle = handle.replace(/^\s*/, '').slice(0, 8).replace(/\s*$/, '');
      }
      if (options.team != null) {
        team = Number(options.team);
        if (team === 0 || team === 1) {
          updates.$set.team = team;
        }
      }
      if (admin) {
        if (options.active != null) {
          updates.$set.active = options.active !== '0';
        }
        updates.$set.name = options.name;
        updates.$set.team = Number(options.team || 0);
        if (options.service != null) {
          updates.$push.services = options.service;
        }
      }
      options = {
        safe: true,
        multi: false,
        upsert: false
      };
      return User.db.collection('users', function(error, users) {
        return users.update(conditions, updates, options, callback);
      });
    };
    User.prototype.logIn = function(session) {
      return session.userId = this._id;
    };
    return User;
  })();
  User.setDb = function(db) {
    this.db = db;
    return Buffset.setDb(db);
  };
  User.create = function(data, service, callback) {
    return this.db.collection('users', function(error, users) {
      var email, handle, isTapjoy, name, user;
      name = [data.firstname, data.lastname];
      handle = (data.firstname[0] + data.lastname[0]).toUpperCase();
      email = data.email;
      isTapjoy = email.match(/@tapjoy\.com$/);
      user = {
        created_at: new Date(),
        active: !!isTapjoy,
        admin: false,
        female: false,
        abuse: false,
        email: email,
        handle: handle,
        name: name.join(' '),
        buffsets: [],
        services: [service]
      };
      return users.insert(user, {
        safe: true
      }, function(error, newUsers) {
        return callback(new User(newUsers[0]));
      });
    });
  };
  User.newService = function(result) {
    return {
      provider: 'google',
      uemail: result.email,
      uid: result.claimedIdentifier,
      uname: [result.firstname, result.lastname].join(' ')
    };
  };
  User.findOne = function(conditions, callback) {
    if (typeof conditions === 'string') {
      conditions = {
        _id: conditions
      };
    }
    if (conditions._id) {
      try {
        conditions._id = new this.db.bson_serializer.ObjectID(String(conditions._id));
      } catch (error) {
        return callback(false);
      }
    }
    return this.db.collection('users', function(error, users) {
      return users.findOne(conditions, function(error, user) {
        if (user) {
          return callback(new User(user));
        } else {
          return callback(false);
        }
      });
    });
  };
  User.findAll = function(conditions, options, callback) {
    var limit, order;
    order = options.order || {};
    limit = options.limit || 1000;
    return this.db.collection('users', function(error, users) {
      return users.find(conditions).sort(order).limit(limit).toArray(function(error, allUsers) {
        if (error) {
          return callback(false);
        } else {
          return callback(_.map(allUsers, function(user) {
            return new User(user);
          }));
        }
      });
    });
  };
  User.count = function(conditions, callback) {
    return this.db.collection('users', function(error, users) {
      return users.count(conditions, function(error, count) {
        return callback(count);
      });
    });
  };
  User.withCurrentUser = function(session, callback) {
    if (session.userId) {
      return User.findOne({
        _id: session.userId
      }, callback);
    } else {
      return callback(false);
    }
  };
  User.withCounts = function(callback) {
    return User.count({}, function(count) {
      return User.count({
        active: true
      }, function(activeCount) {
        return callback({
          count: count,
          activeCount: activeCount
        });
      });
    });
  };
  User.withChartableUsers = function(callback) {
    return User.findAll({
      active: true,
      buffsets: {
        $ne: []
      }
    }, function(activeUsers) {
      if (!activeUsers) {
        callback(false);
        return;
      }
      activeUsers = _.sortBy(activeUsers, function(user) {
        return -user.buffsets.length;
      });
      return callback(activeUsers);
    });
  };
  User.buffsetPieData = function(buffsets) {
    var data, groups;
    groups = _.groupBy(buffsets, function(buffset) {
      return buffset.type;
    });
    data = [];
    _.each(groups, function(group, type) {
      return data.push([type, group.length]);
    });
    return data = _.sortBy(data, function(d) {
      return -d[1];
    });
  };
  User.combinedBuffsetPieData = function(users) {
    var buffsets;
    buffsets = _.map(users, function(user) {
      return user.buffsets;
    });
    return this.buffsetPieData(_.flatten(buffsets));
  };
  module.exports = User;
}).call(this);
