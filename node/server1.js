/*
 * Faye Chat server adapted from Soapbox by James Coglan
 * (https://github.com/jcoglan/faye/tree/master/examples)
 */
var express = require('express'),
    url     = require('url'),
    https   = require('https'),
    faye    = require('./faye'), // Faye at https://github.com/aashay/faye
    request = require('request');

var fayeServer    = new faye.NodeAdapter({mount: '/faye', timeout: 20}),
    port          = process.env.PORT || '8000';

function getOAuthToken(callback) {
	var token_request = 'grant_type=password&client_id=' + process.env.CLIENT_ID + 
	'&client_secret=' + process.env.CLIENT_SECRET + '&username=' + process.env.USERNAME + 
	'&password=' + process.env.PASSWORD;
	
	console.log('Sending token request '+token_request);
	
    request.post({
        uri: process.env.LOGIN_SERVER + '/services/oauth2/token', 
        headers: { 
            'Content-Type': 'application/x-www-form-urlencoded' 
        }, 
        body: token_request
    }, function (error, response, body) {
		if ( response.statusCode == 200 ) {
	    	callback(JSON.parse(body));
		} else {
		    console.log('Error '+response.statusCode+' '+body+' '+error);
		}
    });	
}

// Send message to Force.com
// TODO - handle token timeout
function sendUpstream(oauth, message){
    console.log("Publishing upstream" + JSON.stringify(message))
    request.post({
        uri: oauth.instance_url + '/services/data/v22.0/sobjects/Message__c', 
        headers: { 
            'Authorization': 'OAuth '+oauth.access_token 
        }, 
        json: { 
            Sender__c: message.user, 
            Text__c:   message.message,
            Source__c: message.source,
            Server__c: true
        }
    }, function (error, response, body) {
		if ( response.statusCode != 201 ) {
		    console.log('Error '+response.statusCode+' '+body+' '+error);
		}
    });
}

function sendDownstream(downstreamClient, message){
    console.log("Publishing downstream" + JSON.stringify(message))
    downstreamClient.publish('/chat', message);
}

// Let everyone know a new subscriber has joined
function subscriberJoined(user, oauth, downstreamClient, source) {
    console.log(user+' subscribed');
      
    var message = { message: user+' has joined', server: true, source: source };
    sendDownstream(downstreamClient, message);
    sendUpstream(oauth, message);
}

// Let everyone know a new subscriber has left
function subscriberLeft(user, oauth, downstreamClient, source) {
    console.log(user+' left');
      
    var message = { message: user+' has left', server: true, source: source };
    sendDownstream(downstreamClient, message);
    sendUpstream(oauth, message);
}

// START HERE!
// Get an OAuth token; when we receive it, subscribe for upstream 
// notifications, start the downstream server and push messages around
getOAuthToken(function(oauth) {
  console.log('Got token '+oauth.access_token);
  
  var endpoint = oauth.instance_url+'/cometd';
  
  console.log("Creating a client for "+endpoint);
  var upstreamClient = new faye.Client(endpoint);
  
  // Set up oauth token
  upstreamClient.addExtension({
    outgoing: function(message, callback) {    
      message.ext = message.ext || {};                
      message.ext.cookies = { sid: oauth.access_token };
      callback(message);            
    },              
  });
  
  var downstreamClient = fayeServer.getClient();
  
  console.log('Subscribing to /Messages');
  var upstreamSub = upstreamClient.subscribe('/Messages', function(msg) {
      console.log("Received upstream message: " + JSON.stringify(msg));
      
      if (! msg.Server__c) {
          var message = {
            user:    msg.Sender__c,
            message: msg.Text__c,
            source:  msg.Source__c,
            server:  true
          };
          sendDownstream(downstreamClient, message);
      }
  });
  
  upstreamSub.callback(function() {
    console.log('Upstream subscription is now active');
    
    var downstreamSub = downstreamClient.subscribe('/chat', function(msg) {
        console.log('Received downstream message: ' + JSON.stringify(msg));
        
        if ( ! msg.server ) {
            sendUpstream(oauth, msg);
    	}
    });
    
    downstreamSub.callback(function() {
        // All subscriptions are now active - we're ready to go...
        console.log('Downstream subscription is now active');

        var app = express.createServer();

        app.use(express.static(__dirname + '/public'));

        // Faye server extension to send notifications on subscribes
        var serverExt = {
          incoming: function(message, callback) {
            // Let non-subscribe messages through
            if ( message.channel === '/meta/subscribe' ) {
                // All subscription messages need a user
                if ( ! message.ext || ! message.ext.user ) {
                    message.error = 'message is missing ext.user';
                } else {
                    setTimeout(function(){
                        subscriberJoined(message.ext.user, oauth, downstreamClient, 'external');
                    }, 100);
                }                                
            } else if ( message.channel === '/meta/disconnect' ) {
                // All subscription messages need a user
                if ( ! message.ext || ! message.ext.user ) {
                    message.error = 'message is missing ext.user';
                } else {
                    setTimeout(function(){
                        subscriberLeft(message.ext.user, oauth, downstreamClient, 'external');
                    }, 100);
                }                
            }
            
            // Call the server back now we're done
            return callback(message);
          }
        };

        fayeServer.addExtension(serverExt);

        fayeServer.attach(app);
        
        app.listen(Number(port));

        console.log('Listening on ' + port);
    });
    
    downstreamSub.errback(function(error) {
      console.error("ERROR ON DOWNSTREAM SUBSCRIPTION ATTEMPT: " + error.message);
    });      
  });
  
  upstreamSub.errback(function(error) {
    console.error("ERROR ON UPSTREAM SUBSCRIPTION ATTEMPT: " + error.message);
  });  
});

