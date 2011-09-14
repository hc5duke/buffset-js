_ = require 'underscore'

class Talk
  constructor: (@user, @text) ->
    @created_at = new Date()

  pusherData: () ->
    handle: @user.handle
    text: @text

Talk.create = (user, text) ->
  talk = new Talk user, text
  Talk.db.collection 'talks', (error, talks) ->
    talks.insert talk, safe: true, (error, newTalk) ->
  talk

Talk.setDb = (db) ->
  @db = db

module.exports = Talk
