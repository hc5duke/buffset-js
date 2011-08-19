express = require 'express'
openid = require 'openid'
url = require 'url'
querystring = require 'querystring'
jade = require 'jade'
relyingParty = new openid.RelyingParty 'http://dev:4000/verify', null, false, false, []

app = express.createServer express.logger()

app.get '/', (request, response) ->
  jade.renderFile 'views/index.jade', (error, html) ->
    if error
      response.send 'Something went wrong: ' + error
    else
      response.send html


app.get '/authenticate', (request, response) ->
  # User supplied identifier
  identifier = 'https://www.google.com/accounts/o8/id'

  # Resolve identifier, associate, and build authentication URL
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
  relyingParty.verifyAssertion req, (error, result) ->
    response.send !error && result.authenticated ? 'Success :)' : 'Failure :('


app.get '/users', (request, response) ->


port = process.env.PORT || 4000
app.listen port, ->
  console.log "Listening on " + port
