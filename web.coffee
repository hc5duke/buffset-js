express     = require 'express'
connect     = require 'connect'
openid      = require 'openid'
url         = require 'url'
querystring = require 'querystring'
jade        = require 'jade'
mongo       = require 'mongodb'
Server      = mongo.Server
Db          = mongo.Db
redis       = require 'connect-redis'
RedisStore  = redis express
_           = require 'underscore'
Pusher      = require 'node-pusher'
Helpers     = require './lib/helpers'
User        = require './lib/user'
Buffset     = require './lib/buffset'

port        = process.env.PORT || 4000
app         = express.createServer express.logger()

# OpenID
verifyUrl   = 'https://buffsets.tapjoy.com/verify'
extension = new openid.AttributeExchange
  "http://axschema.org/contact/email": "required"
  "http://axschema.org/namePerson/first": "required"
  "http://axschema.org/namePerson/last": "required"
relyingParty = new openid.RelyingParty verifyUrl, null, false, false, [extension]

# Pusher
pusherChannel   = 'tapjoy_channel'
pusherConfig = []
pusherConfig[7] = '7999' # dev account
pusherConfig[3] = '9e3138091756a4f921d0'
pusherConfig[4] = '584c00ebe3703b0df7c1'
pusherConfig = process.env.PUSHER_URL.split(/:|@|\//) if process.env.PUSHER_URL
pusher = new Pusher appId: pusherConfig[7], key: pusherConfig[3], secret: pusherConfig[4]

# Mongo
dbHost = 'localhost'
dbPort = 27017
dbUser = ''
dbPass = ''
dbName = 'buffsets'

teamNames   = [
  process.env.TEAM_1_NAME || 'Amir'
  process.env.TEAM_2_NAME || 'Johnny'
]

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
  verifyUrl = 'http://localhost:'+port+'/verify'

app.configure 'production', ->
  oneYear = 31557600000
  app.use express.static __dirname + '/public', maxAge: oneYear
  app.use express.errorHandler()
  [x, x, x, dbUser, dbPass, dbHost, dbPort, dbName] = (process.env.MONGOHQ_URL||'').split(/:|@|\//)
  redisConfig = (process.env.REDISTOGO_URL||'').split(/:|@|\//)
  app.use express.session
    secret: "keyboard cat"
    store: new RedisStore
      maxAge: oneYear
      pass: redisConfig[4]
      host: redisConfig[5]
      port: redisConfig[6]

server = new Server dbHost, dbPort, auto_reconnect: true
db = new Db dbName, server
User.setDb db
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

renderWithLocals = (locals, view, next, response) ->
  User.withCounts (userData) ->
    locals = _.extend locals,
      activeUsersCount: userData.activeCount
      usersCount: userData.count
      Helpers: Helpers
    view = 'views/' + view + '.jade'
    jade.renderFile view, {locals: locals}, (error, html) ->
      if error
        next error
      else
        response.send(html)

authorizedToEdit = (currentUser, authorizedUserId, adminOnly) ->
  currentUser.admin || (!adminOnly && authorizedUserId == String(currentUser._id))

app.get '/', (request, response, next) ->
  User.withCurrentUser request.session, (currentUser) ->
    if currentUser
      response.redirect '/users/'
    else
      locals = title: 'Tapjoy Buffsets.js', currentUser: currentUser
      renderWithLocals locals, 'index', next, response


app.get '/services/signout', (request, response, next) ->
  request.session.userId = null #log out
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
  relyingParty.verifyAssertion request, (error, result) ->
    return response.send 'Failure :(' if error || !result.authenticated
    service = User.newService result
    User.findOne 'services.uid': service.uid, (user) ->
      if user
        # 1: existing user, log in
        user.logIn request.session
        response.redirect '/users/'
      else
        callback = (user) ->
          user.logIn(request.session)
          response.redirect '/users/' + user._id + '/edit'
        User.findOne email: result.email, (user) ->
          if user
            # 2: existing user, new service
            user.update service: service, true, () -> callback(user)
          else
            # 3: create user
            User.create result, service, callback


app.get '/users', (request, response, next) ->
  User.findAll {active: true}, {}, (allUsers) ->
    allUsers = _.groupBy allUsers, (user) -> user.buffsets.length
    allUsers = _.map allUsers, (users) ->
      users = _.sortBy users, (user) -> user.handle.toLowerCase()
      users.reverse()
    allUsers = _.flatten(allUsers).reverse()
    User.withCurrentUser request.session, (currentUser) ->
      scores = [0, 0]
      members = _.groupBy allUsers, (user) ->
        scores[user.team] += user.buffsets.length
        user.team
      teams = [
        {name: teamNames[0], score: scores[0], users: members[0], order: 0}
        {name: teamNames[1], score: scores[1], users: members[1], order: 1}
      ]
      locals = title: 'Users', teams: teams, currentUser: currentUser
      renderWithLocals locals, 'users/index', next, response


app.get '/statz', (request, response, next) ->
  User.withCurrentUser request.session, (currentUser) ->
    if !currentUser
      return response.redirect '/users/'
    timeframe = request.query.timeframe
    if timeframe == '7'
      timeframeText = 'last 7 days'
    else if timeframe == '24'
      timeframeText = 'last 24 hours'
    else
      timeframe = '3'
      timeframeText = 'season 3'

    db.collection 'buffsets', (error, buffsets) ->
      conditions = {}
      if timeframe == '7'
        conditions.created_at = $gt: new Date(new Date() - 7 * 24 * 3600 * 1000)
      if timeframe == '24'
        conditions.created_at = $gt: new Date(new Date() - 24 * 3600 * 1000)
      init =
        total: 0
        pushup: 0
        situp: 0
        lunge: 0
        pullup: 0
        wallsits: 0
        plank: 0
        global:
          total: 0
          pushup: 0
          situp: 0
          lunge: 0
          pullup: 0
          wallsits: 0
          plank: 0
      reduce = (doc, out) ->
        out.total++
        out[doc.type]++
        out.global.total++
        out.global[doc.type]++
      buffsets.group {user_id: true}, conditions, init, reduce, (error, statz) ->
        User.findAll {active: true}, {}, (allUsers) ->
          usersHash = {}
          _.each allUsers, (user) ->
            u =
              handle: user.handle
              name: user.name
              team: teamNames[user.team]
              gender: if user.female then 'female' else 'male'
            usersHash[user._id] = u
          User.withCurrentUser request.session, (currentUser) ->
            locals =
              title: 'Statz',
              usersHash: usersHash
              currentUser: currentUser
              timeframe: timeframe
              timeframeText: timeframeText
              statz: statz
            renderWithLocals locals, 'statz', next, response


app.get '/users/:id', (request, response, next) ->
  response.redirect "/users/#{request.params.id}/buffsets"


app.get '/users/:id/buffsets', (request, response, next) ->
  User.findOne _id: request.params.id, (user) ->
    return response.redirect '/users' if !user
    User.withCurrentUser request.session, (currentUser) ->
      locals =
        title: 'Competitive Chartz'
        currentUser: currentUser
        user: user
        series: [ user.buffsetData() ]
        pieData:
          size: 1
          data: user.buffsetPieData()
      renderWithLocals locals, 'chartz/competitive', next, response

app.get '/users/:id/edit', (request, response, next) ->
  User.withCurrentUser request.session, (currentUser) ->
    if authorizedToEdit(currentUser, request.params.id)
      db.collection 'users', (error, users) ->
        next error if error
        id = new db.bson_serializer.ObjectID(request.params.id)
        users.findOne _id: id, (error, user) ->
          next error if error
          locals = title: 'User ' + user.name, user: user, currentUser: currentUser, teamNames: teamNames
          renderWithLocals locals, 'users/edit', next, response
    else
      response.redirect '/users/' + request.params.id


app.get '/admin/users', (request, response, next) ->
  User.withCurrentUser request.session, (currentUser) ->
    if authorizedToEdit(currentUser, '', true)
      userOrder = {team: 1, name: 1}
      User.findAll {active: true}, {order: userOrder}, (activeUsers) ->
        User.findAll {active: {$ne: true}}, {order: userOrder}, (inactiveUsers) ->
          locals =
            title: 'Users'
            activeUsers: activeUsers
            inactiveUsers: inactiveUsers
            currentUser: currentUser
            teamNames: teamNames
          renderWithLocals locals, 'admin/users/index', next, response
    else
      response.redirect '/users'


app.post '/users/:id', (request, response, next) ->
  User.withCurrentUser request.session, (currentUser) ->
    if authorizedToEdit(currentUser, request.params.id)
      currentUser.update request.body.user, false, (error) ->
        response.redirect '/users'
    else
      response.redirect 'back'


app.post '/users/:id/buffsets/create', (request, response, next) ->
  User.withCurrentUser request.session, (currentUser) ->
    if authorizedToEdit(currentUser, request.params.id)
      Buffset.create request.params.id, request.body.user.buffset_type, () ->
        currentUser.pusherData +1, (data) ->
          pusher.trigger pusherChannel, 'buffset', data
        response.redirect '/users'
    else
      response.redirect 'back'


app.post '/admin/users/:id', (request, response, next) ->
  User.withCurrentUser request.session, (currentUser) ->
    return response.redirect '/users' if !currentUser.admin
    User.findOne request.params.id, (user) ->
      user.update request.body.user, true, (error) ->
        response.redirect 'back'


app.get '/chartz', (request, response, next) ->
  User.withCurrentUser request.session, (currentUser) ->
    User.withChartableUsers (activeUsers) ->
      series = _.map activeUsers, (user) -> user.buffsetData()
      locals =
        title: 'Competitive Chartz'
        activeUsers: activeUsers
        currentUser: currentUser
        series: series
        pieData:
          size: 1
          data: User.combinedBuffsetPieData(activeUsers)
      renderWithLocals locals, 'chartz/competitive', next, response


app.get '/chartz/team', (request, response, next) ->
  User.withCurrentUser request.session, (currentUser) ->
    User.withChartableUsers (activeUsers) ->
      teams = _.groupBy activeUsers, (user) -> user.team
      index = -1
      series = _.map teams, (team) ->
        buffsets = _.map team, (user) -> user.buffsets
        buffsets = _.flatten buffsets
        buffsets = _.sortBy buffsets, (buffset) -> buffset.created_at
        currentCount = 0
        data = _.map buffsets, (buffset) ->
          currentCount += 1
          [ buffset.created_at, currentCount ]
        index++
        name: teamNames[index], data: data
      locals =
        title: 'Competitive Chartz'
        activeUsers: activeUsers
        currentUser: currentUser
        series: series
        pieData:
          size: 2
          teamNames: teamNames
          data: [
            User.combinedBuffsetPieData(teams[0])
            User.combinedBuffsetPieData(teams[1])
          ]
      renderWithLocals locals, 'chartz/competitive', next, response


app.get '/chartz/sum', (request, response, next) ->
  User.withCurrentUser request.session, (currentUser) ->
    User.withChartableUsers (activeUsers) ->
      earliest = Infinity
      latest = 0
      buffsets = {}
      _.each activeUsers, (user) ->
        buffsets[user.handle] = {}
      _.each activeUsers, (user) ->
        _.each user.buffsets, (buffset) ->
          created_at = Helpers.endOfDay(buffset.created_at)
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
  User.withCurrentUser request.session, (currentUser) ->
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
