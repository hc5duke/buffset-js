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
helpers = require './lib/helpers'
port = process.env.PORT || 4000
relyingParty = null

pusherConfig = (process.env.PUSHER_URL||'').split(/:|@|\//)
pusher = new Pusher
  appId:  pusherConfig[7]
  appKey: pusherConfig[3]
  secret: pusherConfig[4]
# channel = pusher.channel 'test_channel'

extensions = [
  new openid.AttributeExchange
    "http://axschema.org/contact/email": "required"
    "http://axschema.org/namePerson/first": "required"
    "http://axschema.org/namePerson/last": "required"
]

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
  relyingParty = new openid.RelyingParty 'http://dev:'+port+'/verify', null, false, false, extensions

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
  relyingParty = new openid.RelyingParty 'https://buffsets.tapjoy.com:'+port+'/verify', null, false, false, extensions

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

withUserData = (users, callback) ->
  users.count {active: true}, (error, activeUsersCount) ->
    if !error
      users.count {}, (error, usersCount) ->
        if !error
          callback null,
            activeUsersCount: activeUsersCount
            usersCount: usersCount
        else
          callback error
    else
      callback error

renderWithLocals = (locals, view, callback) ->
  db.collection 'users', (error, users) ->
    withUserData users, (error, userData) ->
      if !error
        locals = _.extend locals,
          active_users_count: userData.activeUsersCount
          users_count: userData.usersCount
          helpers: helpers
        view = 'views/' + view + '.jade'
        jade.renderFile view, {locals: locals}, callback
      else
        callback(error)


app.get '/', (request, response, next) ->
  helpers.usingCurrentUser request.session, db, (error, currentUser) ->
    if currentUser
      response.redirect '/users/'
    else
      next error if error
      locals =
        title: 'Tapjoy Buffsets.js'
        currentUser: currentUser
      renderWithLocals locals, 'index', (error, html) ->
        next error if error
        response.send html


app.get '/services/signout', (request, response, next) ->
  helpers.logOut(request.session)
  response.redirect '/'


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


app.get '/verify', (request, response, next) ->
  relyingParty.verifyAssertion request,
    (error, result) ->
      if error || !result.authenticated
        response.send 'Failure :('
        return
      db.collection 'users', (err, users) ->
        # 1: is there uid?
        service = helpers.newService result
        user = users.findOne 'services.uid': service.uid, (err, user) ->
          if user
            # log in user
            helpers.logIn user, request.session
            response.redirect '/users/'
          else
            # 2: is there email?
            users.findOne email: result.email, (err, user) ->
              next(err) if err
              if user
                user.services = [] if !user.services
                user.services.push service
                users.update({_id: user._id}, {$push: {services: service}}, false, false)
                response.redirect '/users/' + user._id
              else
                # 3: create user
                user = helpers.newUser result
                users.insert(user)
                response.send "new user created"


app.get '/users', (request, response, next) ->
  db.collection 'users', (error, users) ->
    users.find( active: true ).toArray (error, users) ->
      next(error) if error
      helpers.usingCurrentUser request.session, db, (error, currentUser) ->
        next error if error
        locals =
          title: 'Tapjoy Buffsets.js - Users'
          users: users
          currentUser: currentUser
        renderWithLocals locals, 'users/index', (error, html) ->
          next error if error
          response.send html


app.get '/users/:id', (request, response, next) ->
  db.collection 'users', (error, users) ->
    next error if error
    id = new db.bson_serializer.ObjectID(request.params.id)
    users.findOne _id: id, (error, user) ->
      next error if error
      helpers.usingCurrentUser request.session, db, (error, currentUser) ->
        next error if error
        locals =
          title: 'Tapjoy Buffsets.js - User ' + user.name
          user: user
          currentUser: currentUser
        renderWithLocals locals, 'users/show', (error, html) ->
          next error if error
          response.send html


app.listen port, ->
  console.log "Listening on " + port
