(function() {
  var app, express, openid, port, querystring, relyingParty, url;
  express = require('express');
  openid = require('openid');
  url = require('url');
  querystring = require('querystring');
  relyingParty = new openid.RelyingParty('http://dev:4000/verify', null, false, false, []);
  app = express.createServer(express.logger());
  app.get('/', function(request, response) {
    return response.send('<!DOCTYPE html><html><body>' + '<a href="/authenticate">log in</a>' + '</body></html>');
  });
  app.get('/authenticate', function(request, response) {
    var identifier;
    identifier = 'https://www.google.com/accounts/o8/id';
    return relyingParty.authenticate(identifier, false, function(error, authUrl) {
      if (error) {
        return response.send('Authentication failed: ' + error);
      } else if (!authUrl) {
        return response.send('Authentication failed');
      } else {
        console.log(authUrl);
        response.writeHead(302, {
          Location: authUrl
        });
        return response.end();
      }
    });
  });
  app.get('/verify', function(request, response) {
    return relyingParty.verifyAssertion(req, function(error, result) {
      var _ref;
      return response.send((_ref = !error && result.authenticated) != null ? _ref : {
        'Success :)': 'Failure :('
      });
    });
  });
  port = process.env.PORT || 4000;
  app.listen(port, function() {
    return console.log("Listening on " + port);
  });
}).call(this);
