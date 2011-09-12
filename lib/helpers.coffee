module.exports.endOfDay = (date) ->
  day_in_ms = 24 * 3600 * 1000
  new Date(Math.floor(date / day_in_ms) * day_in_ms)
