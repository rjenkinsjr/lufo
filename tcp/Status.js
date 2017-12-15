const Builtins = require('./Builtins.js');
const Customs = require('./Customs.js');

// The status response payload is always the same size.
const statusResponseSize = 14;

const Status = function() {
  // Handler for receiving status bytes. Must be bound to a UFO_TCP instance.
  this.statusResponseHandler = function(data) {
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
            for (const f in Builtins.functionIds) {
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
          data.speed = Customs.flipSpeed(speed - 1);
        }
        if (data.mode.startsWith('function')) {
          data.speed = Builtins.flipSpeed(speed);
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
};
// 0x81 0x8A 0x8B 0x96, always.
// No local flag or checksum; do not pass to TCPUtils.
Status.prototype.request = function() { return Buffer.from([0x81, 0x8A, 0x8B, 0x96]); };
Status.prototype.responseSize = function() { return statusResponseSize; };
Status.prototype.responseHandler = function(ufoTcp) { return this.statusResponseHandler.bind(ufoTcp); };
module.exports = Object.freeze(new Status());
