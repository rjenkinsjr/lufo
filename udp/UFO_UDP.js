const dgram = require('dgram');
const Utils = require('../Utils.js');

/*
 * Exports
 */

var UFO_UDP = module.exports = function(options) {
  // Capture the options provided by the user.
  this._options = Object.freeze(options);
  // Create the UDP socket and other dependent objects.
  // TODO
};

// UDP discovery method.
// Callback takes an error (only for UDP problems) and a data variable.
//
// If a target is specified:
// - An unspecified or negative timeout is coerced to 0.
// - The data variable is either null (not found) or an object.
// If a target is not specified:
// - An unspecified or negative timeout is coerced to 1000ms.
// - The data variable is always an array and never null, but may be empty.
//
// If the timeout is zero (per above), this method waits forever until the
// requested target is found and a discover request is sent every 3 seconds.
const discoverRequest = 'HF-A11ASSISTHREAD';
const discoverPort = 48899;
const discoverTimeout = 1000; // milliseconds
const targetDiscoverInterval = 3000; // milliseconds
const broadcastAddress = '255.255.255.255';
UFO_UDP.discover = function(callback, target, timeout) {
  // Return variables.
  var error = null;
  var data = [];
  // If a target is defined, allow no timeout.
  // Otherwise, set the default timeout if none was given.
  if (target) {
    if (!timeout || timeout < 0) timeout = 0;
  } else {
    if (!timeout || timeout < 0) timeout = discoverTimeout;
  }
  // Setup the socket. Let Node exit if this socket is still active.
  var targetDiscover = null;
  var stopDiscover = null;
  const socket = dgram.createSocket('udp4').unref();
  // Define the listener's event handlers.
  socket.on('close', function() {
    clearInterval(targetDiscover);
    clearTimeout(stopDiscover);
    // If a target was specified, return that object or null.
    if (target) {
      if (data.length > 0) data = data[0];
      else data = null;
    }
    typeof callback === 'function' && callback(error, data);
  });
  socket.on('error', function(err) {
    clearInterval(targetDiscover);
    clearTimeout(stopDiscover);
    error = err;
    socket.close();
  });
  socket.on('message', function(msg, rinfo) {
    if (!error) {
      var message = msg.toString('utf8');
      // The socket sends itself the request message. Ignore this.
      if (message !== discoverRequest) {
        // Message format appears to be:
        // IPv4 address,MAC address,model number
        var splitMessage = message.split(',');
        var ufo = {
          ip: splitMessage[0],
          mac: Utils.macAddress(splitMessage[1]),
          model: splitMessage[2]
        };
        // Check end conditions and update the data appropriately.
        if (target) {
          if (ufo.ip === target || ufo.mac === Utils.macAddress(target)) {
            data.push(ufo);
            socket.close();
          }
        } else {
          data.push(ufo);
        }
      }
    }
  });
  // Send the request and start listening for responses.
  const closeSocket = function() { socket.close(); };
  socket.on('listening', function() {
    socket.setBroadcast(true);
    // Are we searching for a specific target?
    if (target) {
      // A target is specified. Send requests every 3 seconds.
      const targetDiscoverFxn = function() {
        socket.send(discoverRequest, discoverPort, broadcastAddress, function(err) {
          if (err) socket.emit('error', err);
          // If a timeout is configured, set it to stop discovery.
          else if (timeout > 0) stopDiscover = setTimeout(closeSocket, timeout);
        });
      };
      targetDiscoverFxn();
      targetDiscover = setInterval(targetDiscoverFxn, targetDiscoverInterval);
    } else {
      // No target specified. Send a single request.
      socket.send(discoverRequest, discoverPort, broadcastAddress, function(err) {
        if (err) socket.emit('error', err);
        else stopDiscover = setTimeout(closeSocket, timeout);
      });
    }
  });
  socket.bind(discoverPort);
}
