(function() {
  var Buffset, _;
  _ = require('underscore');
  Buffset = (function() {
    function Buffset(user_id, type) {
      this.type = type;
      this.user_id = new Buffset.db.bson_serializer.ObjectID(String(user_id));
      this.created_at = new Date();
    }
    return Buffset;
  })();
  Buffset.create = function(user_id, type, callback) {
    var buffset;
    buffset = new Buffset(user_id, type);
    return Buffset.db.collection('buffsets', function(error, buffsets) {
      return buffsets.insert(buffset, {
        safe: true
      }, function(error, newBuffset) {
        buffset._id = newBuffset[0]._id;
        return Buffset.db.collection('users', function(error, users) {
          var conditions, options, updates;
          conditions = {
            _id: buffset.user_id
          };
          updates = {
            $push: {
              buffsets: buffset
            }
          };
          options = {
            safe: true,
            multi: false,
            upsert: false
          };
          return users.update(conditions, updates, options, callback);
        });
      });
    });
  };
  Buffset.setDb = function(db) {
    return this.db = db;
  };
  module.exports = Buffset;
}).call(this);
