(function() {
  module.exports.endOfDay = function(date) {
    var day_in_ms;
    day_in_ms = 24 * 3600 * 1000;
    return new Date(Math.floor(date / day_in_ms) * day_in_ms);
  };
  module.exports.newService = function(result) {
    return {
      provider: 'google',
      uemail: result.email,
      uid: result.claimedIdentifier,
      uname: [result.firstname, result.lastname].join(' ')
    };
  };
  module.exports.newBuffset = function(userId, buffsetType) {
    return {
      created_at: new Date(),
      user_id: userId,
      type: buffsetType
    };
  };
}).call(this);
