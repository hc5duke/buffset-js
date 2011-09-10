_ = require 'underscore'
Helpers = require './helpers'

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

  tally: (offset) ->
    Helpers.tallyize @buffsets.length + offset

  pusherData: (offset) ->
    id: @_id
    name: @name
    count: @buffsets.length + offset
    tally: @tally(offset)
    abuse: @abuse

  update: (options, callback) ->
    updates = { $set: {} }
    updates.$set.abuse  = options.abuse != '0'  if options.abuse?
    updates.$set.female = options.female != '0' if options.female?
    if options.handle
      handle = options.handle
      updates.$set.handle = handle.replace(/^\s*/, '')[0..7].replace(/\s*$/, '')
    if options.team?
      team = options.team
      updates.$set.team = team if team == 0 || team == 1
    if options.buffset_type?
      buffset = Helpers.newBuffset @_id, options.buffset_type
      updates.$push = buffsets: buffset
    conditions = _id: @_id
    options = safe: true, multi: false, upsert: false
    User.db.collection 'users', (error, users) ->
      users.update conditions, updates, options, callback

User.setDb = (db) ->
  @db = db

User.findOne = (conditions, callback) ->
  if conditions._id
    conditions._id = new @db.bson_serializer.ObjectID(String(conditions._id))
  @db.collection 'users', (error, users) ->
    users.findOne conditions, (error, user) ->
      if user
        callback new User(user)
      else
        callback false

User.findAll = (conditions, callback) ->
  @db.collection 'users', (error, users) ->
    users.find(conditions).toArray (error, allUsers) ->
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

module.exports = User
