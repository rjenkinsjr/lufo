const dgram = require('dgram');
const Constants = lufo.require('udp/Constants');
const UDPUtils = lufo.require('udp/Utils');

// UFO discovery method.
//
// Callback takes an error object and a data array.
// The data array is never null, but may be empty.
// Each object in the array has exactly three properties:
// - ip
// - mac
// - model
//
// An unspecified or negative timeout is coerced to 3000ms.
//
// The port argument specifies which port is used on this machine to send the
// UDP broadcast. If unspecified or non-positive, a random port is used.
module.exports = function(callback, timeout, password, port) {
  // Return variables.
  var error = null;
  var data = [];
  // Set the default password if none was given.
  var hello = password ? password : Constants.defaultHello;
  // Set the default timeout if none was given.
  const discoverTimeout = 3000; // milliseconds
  if (!timeout || timeout < 0) timeout = discoverTimeout;
  // Setup the socket. Let Node exit if this socket is still active.
  var stopDiscover = null;
  const socket = dgram.createSocket('udp4').unref();
  // Define the listener's event handlers.
  socket.on('close', function() {
    clearTimeout(stopDiscover);
    typeof callback === 'function' && callback(error, data);
  });
  socket.on('error', function(err) {
    clearTimeout(stopDiscover);
    error = err;
    socket.close();
  });
  socket.on('message', function(msg, rinfo) {
    if (!error) {
      var message = msg.toString('utf8');
      // The socket sends itself the request message. Ignore this.
      if (message !== hello) {
        // Add the result to our array.
        data.push(UDPUtils.parseHelloResponse(message));
      }
    }
  });
  // Send the request and start listening for responses.
  const closeSocket = function() { socket.close(); };
  socket.on('listening', function() {
    socket.setBroadcast(true);
    socket.send(hello, Constants.port, '255.255.255.255', function(err) {
      if (err) socket.emit('error', err);
      else stopDiscover = setTimeout(closeSocket, timeout);
    });
  });
  // Use the specified port, or a random one.
  if (port >= 0) {
    socket.bind(port);
  } else {
    socket.bind();
  }
}
