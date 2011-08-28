express = require 'express'
connect = require 'connect'
openid = require 'openid'
url = require 'url'
querystring = require 'querystring'
jade = require 'jade'
mongo = require 'mongodb'
_ = require 'underscore'

extensions = [
  new openid.AttributeExchange
    "http://axschema.org/contact/email": "required",
    "http://axschema.org/namePerson/first": "required",
]

console.log extensions
relyingParty = new openid.RelyingParty 'http://dev:4000/verify', null, false, false, extensions

Server = mongo.Server
Db = mongo.Db
app = express.createServer express.logger()
dbHost = 'localhost'
dbPort = 27017
dbUser = ''
dbPass = ''
dbName = 'buffsets'

app.configure 'development', ->
  app.use express.static __dirname + '/public'
  app.use express.errorHandler dumpExceptions: true, showStack: true

app.configure 'production', ->
  oneYear = 31557600000
  app.use express.static __dirname + '/public', maxAge: oneYear
  app.use express.errorHandler()
  arr = process.env.MONGOHQ_URL.split(/:|@|\//)
  dbUser = arr[3]
  dbPass = arr[4]
  dbHost = arr[5]
  dbPort = arr[6]
  dbName = arr[7]


app.configure ->
  app.set 'views', __dirname + '/views'
  app.set 'view engine', 'jade'
  app.use express.bodyParser()

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


helpers =
  fives: (num, unit, one, five, ten) ->
    str = []
    c = num / unit
    if c == 9
      str.push one
      str.push ten
      num -= 9 * unit
    else if c >= 5
      str.push five
      num -= 5 * unit
    else if c == 4
      str.push one
      str.push five
      num -= 4 * unit
    c = Math.floor(num / unit)
    if c > 0
      ones = (one for i in [1..c])
      str.push ones.join ''
      num -= c * unit
    [str.join(''), num]
  romanize: (number) ->
    if number > 3999
      'Inf'
    else
      str = []
      num = number
      arr = helpers.fives(num, 1000, 'M', '?', '?')
      s = arr[0]
      num = arr[1]
      str.push s
      arr = helpers.fives(num, 100, 'C', 'D', 'M')
      s = arr[0]
      num = arr[1]
      str.push s
      arr = helpers.fives(num, 10, 'X', 'L', 'C')
      s = arr[0]
      num = arr[1]
      str.push s
      str.join('')
  tallyize: (number) ->
    if number > 0
      ones = number % 10
      str = [ helpers.romanize(number - ones), ' ' ]
      if ones >= 5
        str.push String.fromCharCode 822, 47, 822, 47, 822, 47, 822, 47
        str.push ' '
        ones = ones - 5
      if ones > 0
        slashes = ('/' for i in [1..ones])
        str.push slashes.join('')
      str.join('').trim()
    else
      "0"

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
      console.log authUrl
      response.writeHead 302, Location: authUrl
      response.end()


app.get '/verify', (request, response) ->
  # Verify identity assertion
  relyingParty.verifyAssertion request,
    (error, result) ->
      if !error && result.authenticated
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



port = process.env.PORT || 4000
app.listen port, ->
  console.log "Listening on " + port
