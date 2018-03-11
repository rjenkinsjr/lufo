const dgram = require('dgram');
const UdpStrings = require('./UdpStrings');
const UdpConstants = require('./UdpConstants');
const UdpUtils = require('./UdpUtils');

// UFO discovery method.
//
// Options are:
// - timeout: milliseconds to wait for responses from UFOs; default is 3000ms.
// - password: password to use to reach UFOs; if unspecified the default is used.
// - localPort: the port bound on this machine to search for UFOs; if unspecified a random port is used.
// - remotePort: the port to which expected UFOs are bound; if unspecified the default is used.
//
// Callback takes an error object and a data array.
// The data array is never null, but may be empty.
// Each object in the array has exactly three properties:
// - ip
// - mac
// - model
module.exports = function(options, callback) {
  // Return variables.
  var error = null;
  var data = [];
  // Set the default password if none was given.
  var hello = options.password ? options.password : UdpStrings.get('defaultHello');
  // Set the default timeout if none was given.
  const discoverTimeout = 3000; // milliseconds
  var timeout = options.timeout;
  if (!timeout || timeout < 0) timeout = discoverTimeout;
  // Set the default remote port if none was given.
  var remotePort = options.remotePort;
  if (!remotePort || remotePort < 0) remotePort = UdpConstants.getDefaultPort();
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
        data.push(UdpUtils.parseHelloResponse(message));
      }
    }
  });
  // Send the request and start listening for responses.
  const closeSocket = function() { socket.close(); };
  socket.on('listening', function() {
    socket.setBroadcast(true);
    socket.send(hello, remotePort, '255.255.255.255', function(err) {
      if (err) socket.emit('error', err);
      else stopDiscover = setTimeout(closeSocket, timeout);
    });
  });
  // Use the specified port, or a random one.
  var localPort = options.localPort;
  if (!localPort || localPort < 0) {
    socket.bind();
  } else {
    socket.bind(localPort);
  }
}
