express = require 'express'
connect = require 'connect'
openid = require 'openid'
url = require 'url'
querystring = require 'querystring'
jade = require 'jade'
mongo = require 'mongodb'
redis = require 'connect-redis'
_ = require 'underscore'
Pusher = require 'node-pusher'
helpers = require './lib/helpers'
port = process.env.PORT || 4000
relyingParty = null

pusher = null
if process.env.PUSHER_URL
  pusherConfig = process.env.PUSHER_URL.split(/:|@|\//)
  pusher = new Pusher
    appId:  pusherConfig[7]
    key: pusherConfig[3]
    secret: pusherConfig[4]
else
  console.log "WARNING: no Pusher"
channel = 'test_channel'
event = 'my_event'

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
  oneYear = 31557600000
  app.use express.static __dirname + '/public'
  app.use express.errorHandler dumpExceptions: true, showStack: true
  app.use express.session
    secret: "keyboard cat"
    store: new RedisStore
      maxAge: oneYear
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
      maxAge: oneYear
      pass: redisConfig[4]
      host: redisConfig[5]
      port: redisConfig[6]
  relyingParty = new openid.RelyingParty 'https://buffsets.tapjoy.com/verify', null, false, false, extensions

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

withCurrentUser = (session, callback) ->
  id = new db.bson_serializer.ObjectID(session.userId)
  db.collection 'users', (error, users) ->
    if error
      callback error
    else
      users.findOne _id: id, (error, currentUser) ->
        callback error, currentUser || false

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

renderWithLocals = (locals, view, next, response) ->
  db.collection 'users', (error, users) ->
    withUserData users, (error, userData) ->
      if !error
        locals = _.extend locals,
          active_users_count: userData.activeUsersCount
          users_count: userData.usersCount
          helpers: helpers
        view = 'views/' + view + '.jade'
        jade.renderFile view, {locals: locals}, (error, html) ->
          if error
            next(error)
          else
            response.send(html)
      else
        next(error)

authorizedToEdit = (currentUser, request, adminOnly) ->
  currentUser.admin || (!adminOnly && request.params.id == String(currentUser._id))


app.get '/', (request, response, next) ->
  withCurrentUser request.session, (error, currentUser) ->
    if currentUser
      response.redirect '/users/'
    else
      next error if error
      locals = title: 'Tapjoy Buffsets.js', currentUser: currentUser
      renderWithLocals locals, 'index', next, response


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
                user.services ||= []
                users.update({_id: user._id}, {$push: {services: service}}, false, false)
              else
                # 3: create user
                user = helpers.newUser result
                email = user.email
                is_tapjoy = email.match /@tapjoy\.com$/ ? true : false
                users.insert(user)
              helpers.logIn user, request.session
              response.redirect '/users/' + user._id + '/edit'


app.get '/users', (request, response, next) ->
  db.collection 'users', (error, users) ->
    users.find( active: true ).toArray (error, allUsers) ->
      next(error) if error
      allUsers = _.groupBy allUsers, (user) -> user.buffsets.length
      allUsers = _.map allUsers, (users) ->
        users = _.sortBy users, (user) -> user.handle.toLowerCase()
        users.reverse()
      allUsers = _.flatten(allUsers).reverse()

      withCurrentUser request.session, (error, currentUser) ->
        next error if error
        locals = title: 'Users', users: allUsers, currentUser: currentUser
        renderWithLocals locals, 'users/index', next, response


app.get '/users/:id', (request, response, next) ->
  db.collection 'users', (error, users) ->
    next error if error
    id = new db.bson_serializer.ObjectID(request.params.id)
    users.findOne _id: id, (error, user) ->
      next error if error
      withCurrentUser request.session, (error, currentUser) ->
        next error if error
        series = []
        if user.buffsets.length > 0
          currentCount = -1
          data = _.map user.buffsets, (buffset) ->
            currentCount += 1
            [ buffset.created_at, currentCount ]
          series = [{ name: user.handle, data: data, multiplier: user.multiplier }]
        locals =
          title: 'Competitive Chartz'
          currentUser: currentUser
          series: series
        renderWithLocals locals, 'chartz/competitive', next, response

app.get '/users/:id/edit', (request, response, next) ->
  withCurrentUser request.session, (error, currentUser) ->
    next error if error
    if authorizedToEdit(currentUser, request)
      db.collection 'users', (error, users) ->
        next error if error
        id = new db.bson_serializer.ObjectID(request.params.id)
        users.findOne _id: id, (error, user) ->
          next error if error
          locals = title: 'User ' + user.name, user: user, currentUser: currentUser
          renderWithLocals locals, 'users/edit', next, response
    else
      response.redirect '/users/' + request.params.id


app.post '/users/:id', (request, response, next) ->
  withCurrentUser request.session, (error, currentUser) ->
    next error if error
    if authorizedToEdit(currentUser, request)
      userParams = request.body.user
      userHash = {}
      userHash.handle = userParams.handle if userParams.handle
      userHash.abuse = userParams.abuse != '0'
      id = new db.bson_serializer.ObjectID(request.params.id)
      db.collection 'users', (error, users) ->
        next error if error
        updates = $set: userHash
        if userParams.buffset_type
          buffset = helpers.newBuffset(request.params.id, userParams.buffset_type)
          updates['$push'] = buffsets: buffset
          if pusher
            users.findOne _id: id, (error, user) ->
              count = user.buffsets.length + 1
              tally = helpers.tallyize(count)
              userData = id: user._id, name: user.name, count: count, tally: tally
              pusher.trigger channel, event, userData
        options = safe: true, multi: false, upsert: false
        users.update {_id: id}, updates, options, (error) ->
          next error if error
          response.redirect '/users'
    else
      response.redirect 'back'


app.get '/admin/users', (request, response, next) ->
  withCurrentUser request.session, (error, currentUser) ->
    next error if error
    if authorizedToEdit(currentUser, request)
      db.collection 'users', (error, users) ->
        users.find({active: {$ne: true}}).toArray (error, inactiveUsers) ->
          next(error) if error
          users.find({active: true}).toArray (error, activeUsers) ->
            next(error) if error
            locals = title: 'Users', activeUsers: activeUsers, inactiveUsers: inactiveUsers, currentUser: currentUser
            renderWithLocals locals, 'admin/users/index', next, response
    else
      response.redirect '/users'


app.post '/admin/users/:id', (request, response, next) ->
  withCurrentUser request.session, (error, currentUser) ->
    next error if error
    if currentUser.admin
      userParams = request.body.user
      userHash = {}
      userHash.active = userParams.active != '0'
      userHash.name = userParams.name
      userHash.handle = userParams.handle
      id = new db.bson_serializer.ObjectID(request.params.id)
      db.collection 'users', (error, users) ->
        next error if error
        options = safe: true, multi: false, upsert: false
        users.update {_id: id}, {$set: userHash }, options, (error) ->
          next error if error
          response.redirect 'back'
    else
      response.redirect '/users'


app.get '/chartz', (request, response, next) ->
  withCurrentUser request.session, (error, currentUser) ->
    db.collection 'users', (error, users) ->
      users.find({active: true}).toArray (error, activeUsers) ->
        activeUsers = _.select activeUsers, (user) ->
          user.buffsets.length > 0
        activeUsers = _.sortBy activeUsers, (user) ->
          - user.buffsets.length
        series = _.map activeUsers, (user) ->
          if user.buffsets.length > 0
            currentCount = 0
            data = _.map user.buffsets, (buffset) ->
              currentCount += 1
              [ buffset.created_at, currentCount ]
            name: user.handle, data: data, multiplier: user.multiplier
        locals =
          title: 'Competitive Chartz'
          activeUsers: activeUsers
          currentUser: currentUser
          series: series
        renderWithLocals locals, 'chartz/competitive', next, response


app.get '/chartz/sum', (request, response, next) ->
  withCurrentUser request.session, (error, currentUser) ->
    db.collection 'users', (error, users) ->
      users.find({active: true}).toArray (error, activeUsers) ->
        activeUsers = _.select activeUsers, (user) ->
          user.buffsets.length > 0
        activeUsers = _.sortBy activeUsers, (user) ->
          - user.buffsets.length
        earliest = Infinity
        latest = 0
        buffsets = {}
        _.each activeUsers, (user) ->
          buffsets[user.handle] = {}
        _.each activeUsers, (user) ->
          _.each user.buffsets, (buffset) ->
            created_at = helpers.endOfDay(buffset.created_at)
            buffsets[user.handle][created_at] ||= 0
            buffsets[user.handle][created_at] += 1
            latest   = created_at if latest   < created_at
            earliest = created_at if earliest > created_at
        date = earliest
        dates = []
        # comile list of dates
        while date <= latest
          dates.push date
          date = new Date(date - 0 + 24 * 3600 * 1000)

        _.each activeUsers, (user) ->
          sum = 0
          arr = []
          _.each dates, (date) ->
            buffsets[user.handle][date] ||= 0
            sum += buffsets[user.handle][date]
            arr.push sum
          buffsets[user.handle] = arr
        data = []
        _.each buffsets, (value, key) ->
          counts = _.map value, (count, date) -> count
          data.push name: key, data: counts

        # make dates array into strings
        dates = _.map dates, (date) -> [1+date.getMonth(), '/', date.getDate()].join ''
        locals =
          title: 'Tapjoy Buffsets.js'
          currentUser: currentUser
          series: data
          categories: dates
        renderWithLocals locals, 'chartz/cumulative', next, response


app.get '/chartz/punch', (request, response, next) ->
  withCurrentUser request.session, (error, currentUser) ->
    db.collection 'users', (error, users) ->
      users.find({active: true}).toArray (error, activeUsers) ->
        days = []
        _.each _.range(7), (day) ->
          days[day] = []
          _.each _.range(24), (hour) ->
            days[day][hour] = 0
        activeUsers = _.select activeUsers, (user) ->
          _.each user.buffsets, (buffset) ->
            created_at = buffset.created_at
            days[created_at.getDay()][created_at.getHours()] += 1
        data = _.flatten days[1..-2]
        max = _.max data
        _.times 24, () ->
          data.push '0'
        hours = []
        weekdays = []
        weekday = 0
        _.times 5, () ->
          range = _.range(24).join ','
          hours.push range
          _.times 24, () ->
            weekdays.push(weekday)
          weekday += 1
        chart_url = [
          'https://chart.googleapis.com/chart?chs=800x300&chds=-1,24,-1,5,0,'
          max
          '&chf=bg,s,efefef&chd=t:'
          hours.join ','
          '|'
          weekdays.join ','
          '|'
          data.join(',')
          "&chxt=x,y&chm=o,333333,1,1.0,25.0&chxl=0:||12am|1|2|3|4|5|6|7|8|9|10|11|12pm|1|2|3|4|5|6|7|8|9|10|11||1:|"
          "|Mon|Tue|Wed|Thr|Fri|&cht=s"
        ].join('')
        locals =
          title: 'Tapjoy Buffsets.js'
          currentUser: currentUser
          chart_url: chart_url
        renderWithLocals locals, 'chartz/punchcard', next, response



app.listen port, ->
  console.log "Listening on " + port
