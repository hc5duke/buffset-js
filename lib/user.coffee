_ = require 'underscore'
Buffset = require './buffset'

class User
  constructor: (user) ->
    @_id        = user._id
    @createdAt  = user.created_at
    @active     = !!user.active
    @admin      = !!user.admin
    @female     = !!user.female
    @abuse      = !!user.abuse
    @email      = user.email
    @handle     = user.handle
    @name       = user.name
    @buffsets   = user.buffsets || []
    @services   = user.services || []
    @team       = Number(user.team || 0)

  buffsetData: () ->
    currentCount = 0
    data = _.map @buffsets, (buffset) ->
      currentCount += 1
      [ buffset.created_at, currentCount ]
    name: @handle, data: data

  buffsetPieData: () ->
    User.buffsetPieData @buffsets

  tally: (offset) ->
    fives = (num, unit, one, five, ten) ->
      str = []
      c = num / unit
      if c == 9
        str.push one, ten
        num -= 9 * unit
      else if c >= 5
        str.push five
        num -= 5 * unit
      else if c == 4
        str.push one, five
        num -= 4 * unit
      c = Math.floor(num / unit)
      if c > 0
        ones = (one for i in [1..c])
        str.push ones.join ''
        num -= c * unit
      [str.join(''), num]

    romanize = (num) ->
      return 'Inf' if num > 3999
      str = []
      [s, n] = fives(num, 1000, 'M', '?', '?')
      str.push s
      [s, n] = fives(n, 100, 'C', 'D', 'M')
      str.push s
      [s, n] = fives(n, 10, 'X', 'L', 'C')
      str.push s
      str.join ''

    number = @buffsets.length + (offset||0)
    if number > 0
      ones = number % 10
      str = [ romanize(number - ones), ' ' ]
      if ones >= 5
        fiveTally = String.fromCharCode 822, 47, 822, 47, 822, 47, 822, 47
        str.push fiveTally, ' '
        ones = ones - 5
      if ones > 0
        slashes = ('/' for i in [1..ones])
        str.push slashes.join('')
      str.join('').trim()
    else
      "0"

  pusherData: (offset) ->
    id: @_id
    name: @name
    count: @buffsets.length + offset
    tally: @tally(offset)

  update: (options, admin, callback) ->
    conditions = _id: @_id
    updates = { $set: {}, $push: {} }
    updates.$set.abuse  = options.abuse != '0'  if options.abuse?
    updates.$set.female = options.female != '0' if options.female?
    if options.handle
      handle = options.handle
      updates.$set.handle = handle.replace(/^\s*/, '')[0..7].replace(/\s*$/, '')
    if options.team?
      team = Number(options.team)
      updates.$set.team = team if team == 0 || team == 1
    if admin
      updates.$set.active     = options.active != '0' if options.active?
      updates.$set.name       = options.name
      updates.$set.team       = Number(options.team || 0)
      updates.$push.services  = options.service if options.service?
    options = safe: true, multi: false, upsert: false
    User.db.collection 'users', (error, users) ->
      users.update conditions, updates, options, callback

  logIn: (session) ->
    session.userId = @_id

User.setDb = (db) ->
  @db = db
  Buffset.setDb db

User.create = (data, service, callback) ->
  @db.collection 'users', (error, users) ->
    name = [data.firstname, data.lastname]
    handle = (data.firstname[0] + data.lastname[0]).toUpperCase()
    email = data.email
    isTapjoy = email.match /@tapjoy\.com$/
    user =
      created_at: new Date()
      active: !!isTapjoy
      admin: false
      female: false
      abuse: false
      email: email
      handle: handle
      name: name.join ' '
      buffsets: []
      services: [ service ]
    users.insert user, safe: true, (error, newUsers) ->
      callback new User newUsers[0]

User.newService = (result) ->
  provider: 'google'
  uemail: result.email
  uid: result.claimedIdentifier
  uname: [result.firstname, result.lastname].join ' '

User.findOne = (conditions, callback) ->
  if typeof(conditions) == 'string'
    conditions = _id: conditions
  if conditions._id
    try
      conditions._id = new @db.bson_serializer.ObjectID(String(conditions._id))
    catch error
      return callback false
  @db.collection 'users', (error, users) ->
    users.findOne conditions, (error, user) ->
      if user
        callback new User(user)
      else
        callback false

User.findAll = (conditions, order, callback) ->
  if typeof order == 'function'
    callback = order
    order = {}
  order ||= {}
  @db.collection 'users', (error, users) ->
    users.find(conditions).sort(order).toArray (error, allUsers) ->
      if error
        callback false
      else
        callback _.map allUsers, (user) -> new User(user)

User.count = (conditions, callback) ->
  @db.collection 'users', (error, users) ->
    users.count conditions, (error, count) ->
      callback count

User.withCurrentUser = (session, callback) ->
  if session.userId
    User.findOne _id: session.userId, callback
  else
    callback false

User.withCounts = (callback) ->
  User.count {}, (count) ->
    User.count active: true, (activeCount) ->
      callback count: count, activeCount: activeCount

User.withChartableUsers = (callback) ->
  User.findAll { active: true, buffsets: {$ne: []} }, (activeUsers) ->
    if !activeUsers
      callback(false)
      return
    activeUsers = _.sortBy activeUsers, (user) -> - user.buffsets.length
    callback(activeUsers)

User.buffsetPieData = (buffsets) ->
  groups = _.groupBy buffsets, (buffset) -> buffset.type
  data = []
  _.each groups, (group, type) ->
    data.push [type, group.length]
  data = _.sortBy data, (d) -> -d[1]

User.combinedBuffsetPieData = (users) ->
  buffsets = _.map users, (user) ->
    user.buffsets
  @buffsetPieData _.flatten buffsets

module.exports = User
