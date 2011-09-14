(function() {
  var Talk, _;
  _ = require('underscore');
  Talk = (function() {
    function Talk(user, text) {
      this.user = user;
      this.text = text;
      this.created_at = new Date();
    }
    Talk.prototype.pusherData = function() {
      return {
        handle: this.user.handle,
        text: this.text
      };
    };
    return Talk;
  })();
  Talk.create = function(user, text) {
    var talk;
    talk = new Talk(user, text);
    Talk.db.collection('talks', function(error, talks) {
      return talks.insert(talk, {
        safe: true
      }, function(error, newTalk) {});
    });
    return talk;
  };
  Talk.setDb = function(db) {
    return this.db = db;
  };
  module.exports = Talk;
}).call(this);
