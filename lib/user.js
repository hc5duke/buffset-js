(function() {
  var Helpers, User, _;
  _ = require('underscore');
  Helpers = require('./helpers');
  User = (function() {
    function User(user) {
      this._id = user._id;
      this.createdAt = user.created_at;
      this.active = !!user.active;
      this.admin = !!user.admin;
      this.female = !!user.female;
      this.abuse = !!user.abuse;
      this.email = user.email;
      this.handle = user.handle;
      this.name = user.name;
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
    User.prototype.tally = function(offset) {
      return Helpers.tallyize(this.buffsets.length + offset);
    };
    User.prototype.pusherData = function(offset) {
      return {
        id: this._id,
        name: this.name,
        count: this.buffsets.length + offset,
        tally: this.tally(offset),
        abuse: this.abuse
      };
    };
    User.prototype.update = function(options, admin, callback) {
      var buffset, conditions, handle, team, updates;
      conditions = {
        _id: this._id
      };
      updates = {
        $set: {}
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
        team = options.team;
        if (team === 0 || team === 1) {
          updates.$set.team = team;
        }
      }
      if (options.buffset_type != null) {
        buffset = Helpers.newBuffset(this._id, options.buffset_type);
        updates.$push = {
          buffsets: buffset
        };
      }
      if (admin) {
        if (options.active != null) {
          updates.$set.active = options.active !== '0';
        }
        updates.$set.name = options.name;
        updates.$set.team = Number(options.team || 0);
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
    return User;
  })();
  User.setDb = function(db) {
    return this.db = db;
  };
  User.findOne = function(conditions, callback) {
    if (typeof conditions === 'string') {
      conditions = {
        _id: conditions
      };
    }
    if (conditions._id) {
      conditions._id = new this.db.bson_serializer.ObjectID(String(conditions._id));
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
  User.findAll = function(conditions, callback) {
    return this.db.collection('users', function(error, users) {
      return users.find(conditions).toArray(function(error, allUsers) {
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
      active: true
    }, function(activeUsers) {
      if (!activeUsers) {
        callback(false);
        return;
      }
      activeUsers = _.select(activeUsers, function(user) {
        return user.buffsets.length > 0;
      });
      activeUsers = _.sortBy(activeUsers, function(user) {
        return -user.buffsets.length;
      });
      return callback(activeUsers);
    });
  };
  module.exports = User;
}).call(this);
