module.exports.endOfDay = (date) ->
  day_in_ms = 24 * 3600 * 1000
  new Date(Math.floor(date / day_in_ms) * day_in_ms)

# move these to user class
module.exports.newService = (result) ->
  provider: 'google'
  uemail: result.email
  uid: result.claimedIdentifier
  uname: [result.firstname, result.lastname].join ' '

module.exports.newBuffset = (userId, buffsetType) ->
  created_at: new Date()
  user_id: userId
  type: buffsetType
