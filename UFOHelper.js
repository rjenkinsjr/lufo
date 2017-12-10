const net = require('net');
const dgram = require('dgram');

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
const discover = function(callback, target, timeout) {
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
  socket.setBroadcast(true);
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
          mac: toMacString(splitMessage[1]),
          model: splitMessage[2]
        };
        // Check end conditions and update the data appropriately.
        if (target) {
          if (ufo.ip === target || ufo.mac === toMacString(target)) {
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

// All UFOs listen on the same port.
const ufoPort = 5577;

// TCP socket (client) creation method.
const initializeClient = function(ufo) {
  // The TCP socket used to communicate with the UFO.
  ufo._client = net.Socket();
  ufo._error = null;
  // Send all data immediately; no buffering.
  ufo._client.setNoDelay(ufo._options.sendImmediately || true);
  // Capture the error so we can respond appropriately.
  ufo._client.on('error', function(err) {
    this._error = err;
  }.bind(ufo));
  // Both sides have FIN'ed. No more communication is allowed on this socket.
  ufo._client.on('close', closeClient.bind(ufo));
  // Any data received by the UFO is a status update.
  ufo._client.on('data', statusReceive.bind(ufo));
  // Initially, ignore all received data.
  ufo._client.pause();
}

// If the UFO FIN'ed first due to inactivity, silently reconnect.
// If the UFO FIN'ed first due to an error, fire the disconnect callback with the error.
// Otherwise, fire the disconnect callback with no error.
//
// Must be bound to a UFO instance.
const closeClient = function() {
  // Assume the UFO closed on its own.
  // Otherwise, the client closed intentionally and no error has occurred.
  var reconnect = !this._dead;
  var err = null;
  if (reconnect) {
    // The UFO closed on its own.
    // If it closed due to an error, do not reconnect.
    err = this._error;
    if (err) reconnect = false;
  }
  // Tear down the socket.
  this._client.unref();
  this._client.destroy();
  // Reconnect if necessary, or just fire the callback.
  if (reconnect) {
    initializeClient(this);
    this.connect();
  } else {
    var callback = this._options.disconnectCallback;
    typeof callback === 'function' && callback(err);
  }
}

// Dead enforcement method.
const stopIfDead = function(ufo, callback) {
  if (ufo._dead) {
    typeof callback === 'function' && callback(new Error(`UFO has been disconnected.`));
  }
  return ufo._dead;
}

// Given a buffer of data destined for a UFO, expands the buffer by 2 and
// inserts the last two bytes (the "local" constant 0x0f, and the checksum).
const prepareBytes = function(buf) {
  var newBuf = Buffer.alloc(buf.length + 2);
  buf.copy(newBuf);
  finalizeBytes(newBuf);
  checksumBytes(newBuf);
  return newBuf;
}
// Adds the "local" flag to the given buffer.
//
// For virtually all datagrams sent to UFOs, the second-to-last byte is either
// 0f (local) or (f0) remote. I'm pretty sure "remote" refers to UFOs that are
// exposed to the Internet via the company's cloud service, which is not in the
// scope of this library, so we always use "local".
//
// Expects a buffer that is sized for transmission to the UFO.
const finalizeBytes = function(buf) {
  buf.writeUInt8(0x0f, buf.length - 2);
}
// Adds the checksum to the buffer.
//
// Sum up all the values in the buffer, then divide by 256.
// The checksum is the remainder.
//
// Expects a buffer that is sized for transmission to the UFO.
const checksumBytes = function(buf) {
  // Sanity.
  var lastIndex = buf.length - 1;
  buf.writeUInt8(0, lastIndex);
  // Do it.
  var checksum = 0;
  for (const value of buf.values()) {
    checksum += value;
  }
  buf.writeUInt8(checksum % 0x100, lastIndex);
}

// Status byte signature (no local flag or checksum)
const statusRequest = Buffer.alloc(4);
statusRequest.writeUInt8(0x81, 0);
statusRequest.writeUInt8(0x8a, 1);
statusRequest.writeUInt8(0x8b, 2);
statusRequest.writeUInt8(0x96, 3);
// Size of all status response messages.
const statusResponseSize = 14;
// Handler for receiving status bytes. Must be bound to a UFO instance.
const statusReceive = function(data) {
  // Add the data to what we already have.
  var oldIndex = this._statusIndex;
  var newIndex = oldIndex + data.length;
  this._statusArray.set(data, oldIndex);
  if (newIndex >= statusResponseSize) {
    // We have the full response. Capture it and reset the storage buffer.
    var responseBytes = Buffer.from(this._statusArray);
    this._statusArray.fill(0);
    // Reset the status response index.
    newIndex = 0;
    // Prepare callback variables.
    var err = null;
    var data = {};
    // Verify the response's integrity.
    if (responseBytes.readUInt8(0) === 0x81) {
      // Compute the actual checksum.
      var lastIndex = statusResponseSize - 1;
      var expectedChecksum = responseBytes.readUInt8(lastIndex);
      responseBytes.writeUInt8(0, lastIndex);
      var actualChecksum = 0;
      for (const value of responseBytes.values()) {
        actualChecksum += value;
      }
      actualChecksum = actualChecksum % 0x100;
      // Compare.
      responseBytes.writeUInt8(expectedChecksum, lastIndex);
      if (expectedChecksum !== actualChecksum) {
        err = new Error('Status check failed (checksum mismatch).');
      }
    } else {
      err = new Error('Status check failed (header mismatch).');
    }

    /*
    Response format:
    0x81 ???a POWER MODE ???b SPEED RED GREEN BLUE WHITE [UNUSED] CHECKSUM

    ???a is unknown. It always seems to be 0x04.
    ???b is unknown; it always seems to be 0x21.
    [UNUSED] is a 3-byte big-endian field whose purpose is unknown. It always seems to be "0x03 0x00 0x00".
    */

    // Add raw bytes to the response.
    data.raw = responseBytes;
    // ON_OFF is always either 0x23 or 0x24.
    if (!err) {
      switch (responseBytes.readUInt8(2)) {
        case 0x23:
          data.power = 'on'
          break;
        case 0x24:
          data.power = 'off';
          break;
        default:
          err = new Error(`Status check failed (impossible power value ${power}).`);
      }
    }
    // MODE:
    // - 0x62 is disco mode or camera mode (called "other").
    // - 0x61 is static color.
    // - 0x60 is custom steps.
    // - Otherwise, it is a function ID.
    if (!err) {
      var mode = responseBytes.readUInt8(3);
      switch (mode) {
        case 0x62:
          data.mode = 'other';
          break;
        case 0x61:
          data.mode = 'static';
          break;
        case 0x60:
          data.mode = 'custom';
          break;
        default:
          var found = false;
          for (var f in functionIds) {
            if (functionIds[f] === mode) {
              data.mode = `function:${f}`;
              found = true;
              break;
            }
          }
          if (!found) err = new Error(`Status check failed (impossible mode ${mode}).`);
          break;
      }
    }
    // SPEED is evaluated based on MODE, and it does not apply to all modes.
    if (!err) {
      var speed = responseBytes.readUInt8(5);
      if (data.mode === 'custom') {
        // The UFO seems to store/report the speed as 1 higher than what it really is.
        data.speed = flipSpeedCustom(speed - 1);
      }
      if (data.mode.startsWith('function')) {
        data.speed = flipSpeedBuiltin(speed);
      }
    }
    // Capture RGBW values as-is.
    if (!err) {
      data.red = responseBytes.readUInt8(6);
      data.green = responseBytes.readUInt8(7);
      data.blue = responseBytes.readUInt8(8);
      data.white = responseBytes.readUInt8(9);
    }
    // Transfer control to the user's callback.
    if (err) data = null;
    this._statusCallback(err, data);
  }
  // Update the status response index.
  this._statusIndex = newIndex;
}

/*
 * On/off byte signatures
 */
// 71 23 0F A3, always (this includes local flag and checksum)
const onRequest = Buffer.alloc(4);
onRequest.writeUInt8(0x71, 0);
onRequest.writeUInt8(0x23, 1);
onRequest.writeUInt8(0x0f, 2);
onRequest.writeUInt8(0xa3, 3);
// 71 24 0F A4, always (this includes local flag and checksum)
const offRequest = Buffer.alloc(4);
offRequest.writeUInt8(0x71, 0);
offRequest.writeUInt8(0x24, 1);
offRequest.writeUInt8(0x0f, 2);
offRequest.writeUInt8(0xa4, 3);

// Clamps RGBW values within the accepted range (0 <= value <= 255).
const clampRGBW = function(num) {
  return clamp(num, 0, 255);
}

// Built-in function names and IDs.
const functionIds = Object.freeze({
  sevenColorCrossFade: 0x25,
  redGradualChange: 0x26,
  greenGradualChange: 0x27,
  blueGradualChange: 0x28,
  yellowGradualChange: 0x29,
  cyanGradualChange: 0x2a,
  purpleGradualChange: 0x2b,
  whiteGradualChange: 0x2c,
  redGreenCrossFade: 0x2d,
  redBlueCrossFade: 0x2e,
  greenBlueCrossFade: 0x2f,
  sevenColorStrobeFlash: 0x30,
  redStrobeFlash: 0x31,
  greenStrobeFlash: 0x32,
  blueStrobeFlash: 0x33,
  yellowStrobeFlash: 0x34,
  cyanStrobeFlash: 0x35,
  purpleStrobeFlash: 0x36,
  whiteStrobeFlash: 0x37,
  sevenColorJumpingChange: 0x38,
  noFunction: 0x61
});
// Given a function name, returns its hex value.
const getFunctionId = function(name) {
  if (!functionIds.hasOwnProperty(name)) throw new Error(`No such built-in function '${name}'.`);
  return functionIds[name];
}
// Converts a built-in function speed value back/forth between what the
// user inputs and what is transmitted in the byte array.
const flipSpeedBuiltin = function(speed) {
  return Math.abs(clamp(speed, 0, 100) - 100);
}

// Maximum number of custom steps per single command.
const customStepsSize = 16;
// Null step, used in custom commands.
const nullStep = Object.freeze({
  red: 1,
  green: 2,
  blue: 3
});
// Converts a custom command speed value back/forth between what the
// user inputs and what is transmitted in the byte array.
const flipSpeedCustom = function(speed) {
  return Math.abs(clamp(speed, 0, 30) - 30);
}

/*
 * Miscellaneous functions
 */
const clamp = function(num, min, max) {
  if (min > max) throw new Error(`Min ${min} greater than max ${max}`);
  return num <= min ? min : num >= max ? max : num;
}
const toMacString = function(mac) {
  return mac.toLowerCase().replace(/-/g, '').replace(/(.{2})/g,"$1:").slice(0, -1);
}

/*
 * Public export
 */
var UFOHelper = module.exports = Object.freeze({
  ufoPort: ufoPort,
  discover: discover,
  initializeClient: initializeClient,
  stopIfDead: stopIfDead,
  prepareBytes: prepareBytes,
  finalizeBytes: finalizeBytes,
  checksumBytes: checksumBytes,
  statusRequest: statusRequest,
  statusResponseSize: statusResponseSize,
  statusReceive: statusReceive,
  onRequest: onRequest,
  offRequest: offRequest,
  clampRGBW: clampRGBW,
  functionIds: functionIds,
  getFunctionId: getFunctionId,
  flipSpeedBuiltin: flipSpeedBuiltin,
  customStepsSize: customStepsSize,
  nullStep: nullStep,
  flipSpeedCustom: flipSpeedCustom,
  clamp: clamp,
  toMacString: toMacString
});
