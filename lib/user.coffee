Class = (value1, value2) ->
  this.value1 = value1 if value1

Class.prototype =
  value1: "default_value"
  method: (argument) ->
    this.value2 = argument + 100

module.exports = Class
