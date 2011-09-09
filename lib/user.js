(function() {
  var Class;
  Class = function(value1, value2) {
    if (value1) {
      return this.value1 = value1;
    }
  };
  Class.prototype = {
    value1: "default_value",
    method: function(argument) {
      return this.value2 = argument + 100;
    }
  };
  module.exports = Class;
}).call(this);
