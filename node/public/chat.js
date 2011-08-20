/*
 * Faye Chat client adapted from Soapbox by James Coglan
 * (https://github.com/jcoglan/faye/tree/master/examples)
 */
Chat = {
    /**
     * Initializes the application, passing in the globally shared Bayeux
     * client. Apps on the same page should share a Bayeux client so
     * that they may share an open HTTP connection with the server.
     */
    init: function(client) {
        var self = this;
        this._client = client;
    
        this._login   = $('#enterUsername');
        this._app     = $('#app');
        this._post    = $('#postMessage');
        this._stream  = $('#stream');
    
        this._app.hide();
    
        $('#username').focus();
    
        // When the user enters a username, store it and start the app
        this._login.submit(function() {
            self._username = $('#username').val();
            self.launch();
            return false;
        });
    },
  
    /**
     * Starts the application after a username has been entered. A
     * subscription is made to receive all messages on the channel,
     * and a form is set up to send messages.
     */
    launch: function() {
        var self = this;
    
        // Add the username to the subscribe message
      	var addUsername = {
      	    outgoing: function(message, callback) {
          	    // Faye client hooks unload and sends disconnect, so we never see
          	    // an unsubscribe
          	    if (message.channel === '/meta/subscribe' || 
                  message.channel === '/meta/disconnect') {
            	    // Add ext field if it's not present
            	    if (!message.ext) message.ext = {};
  	    
            	    // Set the user
            	    message.ext.user = self._username;	            
          	    }

          	    // Carry on and send the message to the server
          	    return callback(message);
      	    }
      	};

      	client.addExtension(addUsername);
	
        // Subscribe to the chat channel
        var subscription = self._client.subscribe('/chat', self.accept, self);
  
        subscription.callback(function() {
            // Append user name to Post message label
            $('#messageLabel').append(html.escapeAttrib(self._username));

            // Hide login form, show main application UI
            self._login.fadeOut('slow', function() {
                self._app.fadeIn('slow', function() {
                    $('#message').focus();
                });
            });
    
            // When we enter a message, send it and clear the message field.
            self._post.submit(function() {
                var msg = $('#message');
                self.post(msg.val());
                msg.val('');
                msg.focus();
                return false;
            });
        });
    
        subscription.errback(function(error) {
            alert("Error subscribing: " + error.message);
        });
    },
  
    /**
     * Sends messages that the user has entered.
     */
    post: function(message) {
        // Message object to transmit over Bayeux channels
        message = {user: this._username, message: message, source: 'external'};
    
        // Publish to the chat channel
        this._client.publish('/chat', message);
    },
  
    /**
     * Handler for received messages. Takes the
     * message object sent by the post() method and displays it in
     * the user's message list.
     */
    accept: function(message) {
        this._stream.prepend('<li class="' + 
            html.escapeAttrib(message.source) + '">'+ 
            (message.user ? '<b>' + html.escapeAttrib(message.user) + ':</b> ' : '' ) +
            html.escapeAttrib(message.message) + '</li>');
    }
};

