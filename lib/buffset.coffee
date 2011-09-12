_ = require 'underscore'

class Buffset
  constructor: (user_id, @type) ->
    @user_id = new Buffset.db.bson_serializer.ObjectID(String(user_id))
    @created_at = new Date()

Buffset.create = (user_id, type, callback) ->
  buffset = new Buffset user_id, type
  Buffset.db.collection 'buffsets', (error, buffsets) ->
    buffsets.insert buffset, safe: true, (error, newBuffset) ->
      buffset._id = newBuffset[0]._id
      Buffset.db.collection 'users', (error, users) ->
        conditions = _id: buffset.user_id
        updates = $push: {buffsets: buffset}
        options = safe: true, multi: false, upsert: false
        users.update conditions, updates, options, callback

Buffset.setDb = (db) ->
  @db = db

module.exports = Buffset
