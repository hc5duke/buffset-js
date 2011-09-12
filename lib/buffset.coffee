_ = require 'underscore'

class Buffset
  constructor: (user_id, type) ->
    hash =
      created_at: new Date()
      user_id: user_id
      type: type
    Buffset.db.collection 'buffsets', (error, buffsets) ->
      buffsets.insert hash, safe: true, (error, newBuffset) ->
        hash._id = newBuffset._id
        Buffset.db.collection 'users', (error, users) ->
          conditions = _id: user_id
          updates = $push: {buffsets: hash}
          options = safe: true, multi: false, upsert: false
          users.update conditions, updates, options
    hash

Buffset.setDb = (db) ->
  @db = db

module.exports = Buffset
