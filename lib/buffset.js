(function() {
  var Buffset, _;
  _ = require('underscore');
  Buffset = (function() {
    function Buffset(user_id, type) {
      var hash;
      hash = {
        created_at: new Date(),
        user_id: user_id,
        type: type
      };
      Buffset.db.collection('buffsets', function(error, buffsets) {
        return buffsets.insert(hash, {
          safe: true
        }, function(error, newBuffset) {
          hash._id = newBuffset._id;
          return Buffset.db.collection('users', function(error, users) {
            var conditions, options, updates;
            conditions = {
              _id: user_id
            };
            updates = {
              $push: {
                buffsets: hash
              }
            };
            options = {
              safe: true,
              multi: false,
              upsert: false
            };
            return users.update(conditions, updates, options);
          });
        });
      });
      hash;
    }
    return Buffset;
  })();
  Buffset.setDb = function(db) {
    return this.db = db;
  };
  module.exports = Buffset;
}).call(this);
