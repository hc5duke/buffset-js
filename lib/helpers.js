(function() {
  var Helpers;
  Helpers = (function() {
    function Helpers() {}
    return Helpers;
  })();
  Helpers.endOfDay = function(date) {
    var day_in_ms;
    day_in_ms = 24 * 3600 * 1000;
    return new Date(Math.floor(date / day_in_ms) * day_in_ms);
  };
  module.exports = Helpers;
}).call(this);
