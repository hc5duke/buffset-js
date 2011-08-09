express = require 'express'
openid = require 'openid'
url = require 'url'
querystring = require 'querystring'
relyingParty = new openid.RelyingParty 'http://dev:4000/verify', null, false, false, []

app = express.createServer express.logger()

app.get '/', (request, response) ->
  response.send('<!DOCTYPE html><html><body>' +
    '<a href="/authenticate">log in</a>' +
    '</body></html>');

app.get '/authenticate', (request, response) ->
  # User supplied identifier
  identifier = 'https://www.google.com/accounts/o8/id'

  # Resolve identifier, associate, and build authentication URL
  relyingParty.authenticate identifier, false, (error, authUrl) ->
    if error
      # response.writeHead 200
      response.send 'Authentication failed: ' + error
    else if !authUrl
      # response.writeHead 200
      response.send 'Authentication failed'
    else
      console.log authUrl
      response.writeHead 302, Location: authUrl
      response.end()

app.get '/verify', (request, response) ->
  # Verify identity assertion
  # NOTE: Passing just the URL is also possible
  relyingParty.verifyAssertion req, (error, result) ->
    # response.writeHead 200
    response.send !error && result.authenticated ? 'Success :)' : 'Failure :('

port = process.env.PORT || 4000
app.listen port, ->
  console.log "Listening on " + port
