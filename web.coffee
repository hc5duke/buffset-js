express = require 'express'
openid = require 'openid'
url = require 'url'
querystring = require 'querystring'
jade = require 'jade'
mongo = require 'mongodb'
relyingParty = new openid.RelyingParty 'http://dev:4000/verify', null, false, false, []

Server = mongo.Server
Db = mongo.Db
server = new Server 'localhost', 27017, auto_reconnect: true
db = new Db 'buffsets', server
db.open (err, db) ->
  if !err
    console.log("We are connected")
app = express.createServer express.logger()

app.configure 'development', ->
  app.use express.static __dirname + '/public'
  app.use express.errorHandler dumpExceptions: true, showStack: true

app.configure 'production', ->
  oneYear = 31557600000
  app.use express.static __dirname + '/public', maxAge: oneYear
  app.use express.errorHandler()


app.set 'views', __dirname + '/views'
app.set 'view engine', 'jade'


app.get '/', (request, response) ->
  response.render 'index'


app.get '/authenticate', (request, response) ->
  identifier = 'https://www.google.com/accounts/o8/id'

  relyingParty.authenticate identifier, false, (error, authUrl) ->
    if error
      response.send 'Authentication failed: ' + error
    else if !authUrl
      response.send 'Authentication failed'
    else
      console.log authUrl
      response.writeHead 302, Location: authUrl
      response.end()


app.get '/verify', (request, response) ->
  # Verify identity assertion
  relyingParty.verifyAssertion request, (error, result) ->
    if !error && result.authenticated
      response.send result
    else
      response.send 'Failure :('


app.get '/users', (request, response) ->
  db.collection 'users', (err, collection) ->
    collection.find( active: true ).toArray (err, users) ->
      jade.renderFile 'views/users/index.jade'
        , locals:
          title: 'Buffsets.js - Users'
          , users: users
        , (error, html) ->
          response.send html


app.get '/users/:id', (request, response) ->
  db.collection 'users', (err, collection) ->
    collection.findOne _id: request.params.id, (err, user) ->
      jade.renderFile 'views/users/show.jade'
        , locals:
          title: 'Buffsets.js - Users'
          , user: user
        , (error, html) ->
          console.log request.params.id
          console.log err
          console.log user
          response.send html


port = process.env.PORT || 4000
app.listen port, ->
  console.log "Listening on " + port
