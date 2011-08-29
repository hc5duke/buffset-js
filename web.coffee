express = require 'express'
connect = require 'connect'
openid = require 'openid'
url = require 'url'
querystring = require 'querystring'
jade = require 'jade'
mongo = require 'mongodb'
redis = require 'connect-redis'
_ = require 'underscore'
Pusher = require 'pusher'

pusherConfig = (process.env.PUSHER_URL||'').split(/:|@|\//)
pusher = new Pusher
  appId:  pusherConfig[7]
  appKey: pusherConfig[3]
  secret: pusherConfig[4]
# channel = pusher.channel 'test_channel'


helpers = require './lib/helpers'

extensions = [
  new openid.AttributeExchange
    "http://axschema.org/contact/email": "required"
    "http://axschema.org/namePerson/first": "required"
    "http://axschema.org/namePerson/last": "required"
]

relyingParty = new openid.RelyingParty 'http://dev:4000/verify', null, false, false, extensions

Server = mongo.Server
Db = mongo.Db
RedisStore = redis express
app = express.createServer express.logger()
dbHost = 'localhost'
dbPort = 27017
dbUser = ''
dbPass = ''
dbName = 'buffsets'

app.configure ->
  app.set 'views', __dirname + '/views'
  app.set 'view engine', 'jade'
  app.use express.bodyParser()
  app.use express.cookieParser()

app.configure 'development', ->
  app.use express.static __dirname + '/public'
  app.use express.errorHandler dumpExceptions: true, showStack: true
  app.use express.session
    secret: "keyboard cat"
    store: new RedisStore
      maxAge: 24 * 60 * 60 * 1000

app.configure 'production', ->
  oneYear = 31557600000
  app.use express.static __dirname + '/public', maxAge: oneYear
  app.use express.errorHandler()
  arr = (process.env.MONGOHQ_URL||'').split(/:|@|\//)
  dbUser = arr[3]
  dbPass = arr[4]
  dbHost = arr[5]
  dbPort = arr[6]
  dbName = arr[7]
  redisConfig = (process.env.REDISTOGO_URL||'').split(/:|@|\//)
  app.use express.session
    secret: "keyboard cat"
    store: new RedisStore
      maxAge: 90 * 24 * 60 * 60 * 1000
      pass: redisConfig[4]
      host: redisConfig[5]
      port: redisConfig[6]


server = new Server dbHost, dbPort, auto_reconnect: true
db = new Db dbName, server
db.open (err, db) ->
  if !err
    console.log "MongoDB connected"
    if dbUser && dbPass
      db.authenticate dbUser, dbPass, (err) ->
        if err
          console.log err
        else
          console.log "MongoDB authenticated"
  else
    console.log err

getLocals = (more) ->
  _.extend more, active_users_count: 2
    , users_count: 3
    , admin: true
    , helpers: helpers


app.get '/', (request, response, next) ->
  locals = getLocals title: 'Tapjoy Buffsets.js'
  jade.renderFile 'views/index.jade'
    , locals: locals
    , (error, html) ->
      next error if error
      response.send html


app.get '/authenticate', (request, response) ->
  identifier = 'https://www.google.com/accounts/o8/id'

  relyingParty.authenticate identifier, false, (error, authUrl) ->
    if error
      response.send 'Authentication failed: ' + error
    else if !authUrl
      response.send 'Authentication failed'
    else
      response.writeHead 302, Location: authUrl
      response.end()


app.get '/verify', (request, response) ->
  relyingParty.verifyAssertion request,
    (error, result) ->
      if !error && result.authenticated
        uid = result.claimedIdentifier
        name = result.firstname + ' ' + result.lastname
        email = result.email
        # basically: user.find_by_service_uid(uid)
        # then create or log in
        response.send result
      else
        response.send 'Failure :('


app.get '/users', (request, response, next) ->
  db.collection 'users', (err, collection) ->
    collection.find( active: true ).toArray (err, users) ->
      next(err) if err
      locals = getLocals
        title: 'Tapjoy Buffsets.js - Users'
        , users: users
        , current_user: users[0]
      jade.renderFile 'views/users/index.jade'
        , locals: locals
        , (error, html) ->
          if error
            next error
          response.send html


app.get '/users/:id', (request, response, next) ->
  db.collection 'users', (err, collection) ->
    collection.find( _id:  new db.bson_serializer.ObjectID(request.params.id) ).toArray (err, users) ->
      next(err) if err
      locals = getLocals
        title: 'Tapjoy Buffsets.js - User ' + users[0].name
        , user: users[0]
        , users: users
        , current_user: users[0]
      jade.renderFile 'views/users/show.jade'
        , locals: locals
        , (error, html) ->
          if error
            next error
          response.send html


app.post '/users/:id', (request, response, next) ->
  user = pushup_set_count: request.body.user.pushup_set_count
  db.collection 'users', (err, collection) ->
    collection.update {}
      , $set : user
      , { }
      , (err) ->
        response.redirect 'back'


app.get '/cart/add/:item', (req, res) ->
  req.session.items = req.session.items || []
  req.session.items.push(req.params.item)
  res.send 'cart is now ' + '[' + req.session.items.join(',') + ']'


app.get '/cart', (req, res) ->
  req.session.items = req.session.items || []
  if req.session.items && req.session.items.length
    res.send 'shopping-cart: ' + req.session.items.join(',')


port = process.env.PORT || 4000
app.listen port, ->
  console.log "Listening on " + port
