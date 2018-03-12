// @flow
import TcpBuiltins from './TcpBuiltins';
import TcpCustoms from './TcpCustoms';

/* Private variables */
const header = 0x81;
const request: Array<number> = [header, 0x8A, 0x8B, 0x96];
const responseSize = 14;

/** A function that parses the response from a UFO "status" TCP command. */
type StatusResponseHandler = (data: Buffer) => void;

/** Static methods for parsing a UFO's status byte stream. */
export default class {
  /**
   * Returns the bytes for the status request command. The returned buffer already
   * contains the "local" byte and the checksum byte; do not pass this value to tcp/Utils.
   */
  static getRequest(): Buffer { return Buffer.from(request); }
  /** Returns 14, the size of the status command response. */
  static getResponseSize(): number { return responseSize; }
  /** Returns a response handler function, bound to the given {@link TcpClient}. */
  static getResponseHandler(tcpClient: Object): StatusResponseHandler {
    return function (data: Buffer) {
      if (!this._error) {
        // Add the data to what we already have.
        const oldIndex = this._statusIndex;
        let newIndex = oldIndex + data.length;
        this._statusArray.set(data, oldIndex);
        if (newIndex >= responseSize) {
          // We have the full response. Capture it and reset the storage buffer.
          const responseBytes = Buffer.from(this._statusArray);
          this._statusArray.fill(0);
          // Reset the status response index.
          newIndex = 0;
          // Prepare callback variables.
          let err = null;
          let result = {};
          // Verify the response's integrity.
          if (responseBytes.readUInt8(0) === header) {
            // Compute the actual checksum.
            const lastIndex = responseSize - 1;
            const expectedChecksum = responseBytes.readUInt8(lastIndex);
            responseBytes.writeUInt8(0, lastIndex);
            let actualChecksum = 0;
            for (const value of responseBytes.values()) {
              actualChecksum += value;
            }
            actualChecksum %= 0x100;
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
          result.raw = responseBytes;
          // ON_OFF is always either 0x23 or 0x24.
          if (!err) {
            const power = responseBytes.readUInt8(2);
            switch (power) {
              case 0x23:
                result.power = 'on';
                break;
              case 0x24:
                result.power = 'off';
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
            const mode = responseBytes.readUInt8(3);
            switch (mode) {
              case 0x62:
                result.mode = 'other';
                break;
              case 0x61:
                result.mode = 'static';
                break;
              case 0x60:
                result.mode = 'custom';
                break;
              default:
                var found = false;
                for (const f in TcpBuiltins.getFunctions().toObject()) {
                  if (TcpBuiltins.getFunctionId(f) === mode) {
                    result.mode = `function:${f}`;
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
            const speed = responseBytes.readUInt8(5);
            if (result.mode === 'custom') {
              // The UFO seems to store/report the speed as 1 higher than what it really is.
              result.speed = TcpCustoms.flipSpeed(speed - 1);
            }
            if (result.mode.startsWith('function')) {
              result.speed = TcpBuiltins.flipSpeed(speed);
            }
          }
          // Capture RGBW values as-is.
          if (!err) {
            result.red = responseBytes.readUInt8(6);
            result.green = responseBytes.readUInt8(7);
            result.blue = responseBytes.readUInt8(8);
            result.white = responseBytes.readUInt8(9);
          }
          // Transfer control to the user's callback.
          if (err) result = null;
          this._statusCallback(err, result);
        }
        // Update the status response index.
        this._statusIndex = newIndex;
      }
    }.bind(tcpClient);
  }
}
