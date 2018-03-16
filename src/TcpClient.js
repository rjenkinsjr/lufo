// @flow
import * as net from 'net';
import _ from 'lodash';

/** One of the possible built-in function names. */
export type BuiltinFunction =
  'sevenColorCrossFade' |
  'redGradualChange' |
  'greenGradualChange' |
  'blueGradualChange' |
  'yellowGradualChange' |
  'cyanGradualChange' |
  'purpleGradualChange' |
  'whiteGradualChange' |
  'redGreenCrossFade' |
  'redBlueCrossFade' |
  'greenBlueCrossFade' |
  'sevenColorStrobeFlash' |
  'redStrobeFlash' |
  'greenStrobeFlash' |
  'blueStrobeFlash' |
  'yellowStrobeFlash' |
  'cyanStrobeFlash' |
  'purpleStrobeFlash' |
  'whiteStrobeFlash' |
  'sevenColorJumpingChange' |
  'noFunction' |
  'postReset';
/** One of the possible custom function modes. */
export type CustomMode = 'gradual' | 'jumping' | 'strobe';
/**
 * A custom function step definition. At runtime, all values are clamped to
 * 0-255 inclusive.
 */
export type CustomStep = {
  red: number,
  green: number,
  blue: number
};

/* Private variables. */
const statusHeader = 0x81;
// Do not pass these values to _prepareBytes().
const statusRequest = Buffer.from([statusHeader, 0x8A, 0x8B, 0x96]);
const statusResponseSize = 14;
// Do not pass these values to _prepareBytes().
const powerOn = Buffer.from([0x71, 0x23, 0x0F, 0xA3]);
// Do not pass these values to _prepareBytes().
const powerOff = Buffer.from([0x71, 0x24, 0x0F, 0xA4]);
const noFunctionValue = 0x61;
const builtinFunctionMap: Map<BuiltinFunction, number> = new Map([
  ['sevenColorCrossFade', 0x25],
  ['redGradualChange', 0x26],
  ['greenGradualChange', 0x27],
  ['blueGradualChange', 0x28],
  ['yellowGradualChange', 0x29],
  ['cyanGradualChange', 0x2A],
  ['purpleGradualChange', 0x2B],
  ['whiteGradualChange', 0x2C],
  ['redGreenCrossFade', 0x2D],
  ['redBlueCrossFade', 0x2E],
  ['greenBlueCrossFade', 0x2F],
  ['sevenColorStrobeFlash', 0x30],
  ['redStrobeFlash', 0x31],
  ['greenStrobeFlash', 0x32],
  ['blueStrobeFlash', 0x33],
  ['yellowStrobeFlash', 0x34],
  ['cyanStrobeFlash', 0x35],
  ['purpleStrobeFlash', 0x36],
  ['whiteStrobeFlash', 0x37],
  ['sevenColorJumpingChange', 0x38],
  ['noFunction', noFunctionValue],
  ['postReset', 0x63],
]);
const builtinFunctionReservedNames: Array<BuiltinFunction> = [
  'noFunction',
  'postReset',
];
const maxBuiltinSpeed = 100;
const maxCustomSteps = 16;
const nullStep: CustomStep = { red: 1, green: 2, blue: 3 };
Object.freeze(nullStep);
const maxCustomSpeed = 30;

/* Private functions. */
/**
 * Clamps the input to 0-255 inclusive, for use as an RGBW value.
 * @private
 */
const _clampRGBW = function (value: number): number {
  return _.clamp(value, 0, 255);
};
/**
 * Given a buffer of data destined for the TCP socket, expands the buffer by 2
 * and inserts the last two bytes (the "local" flag 0x0f and the checksum). A
 * new buffer is returned; the input buffer is not modified.
 * @private
 */
const _prepareBytes = function (buf: Buffer): Buffer {
  const newBuf = Buffer.alloc(buf.length + 2);
  buf.copy(newBuf);
  // Add the "local" flag to the given buffer.
  //
  // For virtually all datagrams sent to UFOs, the second-to-last byte is either
  // 0f (local) or (f0) remote. "Remote" refers to UFOs that are exposed to the
  // Internet via the company's cloud service, which is not supported by this
  // library, so we always use "local".
  newBuf.writeUInt8(0x0f, newBuf.length - 2);
  // Zero out the checksum field for safety.
  const lastIndex = newBuf.length - 1;
  newBuf.writeUInt8(0, lastIndex);
  // Sum up all the values in the buffer, then divide by 256.
  // The checksum is the remainder.
  let checksum = 0;
  Array.from(newBuf.values()).forEach((value) => { checksum += value; });
  checksum %= 0x100;
  newBuf.writeUInt8(checksum, lastIndex);
  // Done.
  return newBuf;
};
/**
 * Converts a built-in function speed value back and forth between the API
 * value and the internal value. Input and output are clamped to 0-100
 * inclusive.
 * @private
 */
const _builtinFlipSpeed = function (speed: number): number {
  return Math.abs(_.clamp(speed, 0, maxBuiltinSpeed) - maxBuiltinSpeed);
};
/**
 * Converts a custom function speed value back and forth between the API value
 * and the internal value. Input and output are clamped to 0-30 inclusive.
 * @private
 */
const _customFlipSpeed = function (speed: number): number {
  return Math.abs(_.clamp(speed, 0, maxCustomSpeed) - maxCustomSpeed);
};

/**
 * Indicates whether or not the given object is equivalent to a null custom step.
 * @private
 */
const _isNullStep = function (step: CustomStep) {
  return step.red === nullStep.red &&
    step.green === nullStep.green &&
    step.blue === nullStep.blue;
};

/** Provides an API to UFOs for interacting with the UFO's TCP server. */
export default class {
  constructor(ufo: Object, options: Object) {
    this._ufo = ufo;
    this._options = options;
    Object.freeze(this._options);
    this._createSocket();
  }
  /**
   * Reacts to the "close" event on the TCP socket inside this client.
   * - If the UFO FIN'ed first due to inactivity, silently reconnect.
   * - If the UFO FIN'ed first due to an error, fire the disconnect callback
   * with the error.
   * - Otherwise, fire the disconnect callback with no error.
   * @private
   */
  _closeSocket(): void {
    // Assume the UFO closed on its own.
    // Otherwise, the socket closed intentionally and no error has occurred.
    let reconnect = !this._dead;
    let err = null;
    if (reconnect) {
      // The UFO closed on its own.
      // If it closed due to an error, do not reconnect.
      err = this._error;
      if (err) reconnect = false;
    }
    // Tear down the socket.
    this._socket.unref();
    this._socket.destroy();
    // Reconnect if necessary, or fire the disconnect callback.
    if (reconnect) {
      this._createSocket();
      this.connect();
    } else {
      // Mark this client as dead and notify the UFO object.
      this._dead = true;
      this._ufo.emit('tcpDead', this._error);
    }
  }
  /**
   * Creates/initializes the TCP socket inside this client. Also initializes/
   * resets other variables needed to manage connection status.
   * @private
   */
  _createSocket(): void {
    // UFOs will close TCP connections after a cetain time of not receiving any
    // data. TCP keepalives from Node don't seem to help.
    // This flag is used by the "close" event handler to re-establish a
    // connection that was unknowingly closed by the UFO.
    //
    // If this is true, this UFO instance is unusable and will no longer perform
    // any UFO control methods (e.g. rgbw).
    this._dead = false;
    // Storage/tracking for the status response.
    this._statusArray = new Uint8Array(statusResponseSize);
    this._statusIndex = 0;
    // The TCP socket used to communicate with the UFO.
    this._socket = net.Socket();
    this._error = null;
    // Send all data immediately; no buffering.
    this._socket.setNoDelay(this._options.sendImmediately || true);
    // Capture errors so we can respond appropriately.
    this._socket.on('error', (err) => {
      // Do NOT set the dead flag here!
      // The close handler needs its current status.
      this._error = err;
      // NodeJS automatically emits a "close" event after an "error" event.
    });
    // Both sides have FIN'ed. No more communication is allowed on this socket.
    this._socket.on('close', () => { this._closeSocket(); });
    // Any TCP data received from the UFO is a status update.
    this._socket.on('data', (data: Buffer) => { this._receiveStatus(data); });
    // Initially, ignore all received data.
    this._socket.pause();
  }
  /**
   * Handles TCP data received as a result of calling the "status" command.
   * @private
   */
  _receiveStatus(data: Buffer): void {
    if (!this._error) {
      // Add the data to what we already have.
      const oldIndex = this._statusIndex;
      let newIndex = oldIndex + data.length;
      this._statusArray.set(data, oldIndex);
      if (newIndex >= statusResponseSize) {
        // We have the full response. Capture it and reset the storage buffer.
        const responseBytes = Buffer.from(this._statusArray);
        this._statusArray.fill(0);
        // Reset the status response index.
        newIndex = 0;
        // Prepare callback variables.
        let err = null;
        let result = {};
        // Verify the response's integrity.
        if (responseBytes.readUInt8(0) === statusHeader) {
          // Compute the actual checksum.
          const lastIndex = statusResponseSize - 1;
          const expectedChecksum = responseBytes.readUInt8(lastIndex);
          responseBytes.writeUInt8(0, lastIndex);
          let actualChecksum = 0;
          Array.from(responseBytes.values()).forEach((value) => {
            actualChecksum += value;
          });
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
            case 0x62: {
              result.mode = 'other';
              break;
            }
            case 0x61: {
              result.mode = 'static';
              break;
            }
            case 0x60: {
              result.mode = 'custom';
              break;
            }
            default: {
              let name: ?string = null;
              builtinFunctionMap.forEach((v, k) => {
                if (name !== null && v === mode) name = k;
              });
              if (name) {
                result.mode = `function:${name}`;
              } else {
                err = new Error(`Status check failed (impossible mode ${mode}).`);
              }
              break;
            }
          }
        }
        // SPEED is evaluated based on MODE, and it does not apply to all modes.
        if (!err) {
          const speed = responseBytes.readUInt8(5);
          if (result.mode === 'custom') {
            // The UFO seems to store/report the speed as 1 higher than what it
            // really is.
            result.speed = _customFlipSpeed(speed - 1);
          }
          if (result.mode.startsWith('function')) {
            result.speed = _builtinFlipSpeed(speed);
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
  }
  /**
   * Sends the data in the given buffer to the TCP socket, then invokes the
   * given callback.
   * @private
   */
  _write(buffer: Buffer, callback: ?() => mixed): void {
    if (callback) {
      this._socket.write(buffer, callback);
    } else {
      this._socket.write(buffer);
    }
  }
  /**
   * The TCP command sent by this method appears to set/synchronize time on the
   * UFO. This is based on the construction of the payload, as observed via
   * packet sniffing. The given callback, if any, is invoked after the command
   * is sent.
   * - The Android app appears to send this command when a UFO is factory reset
   * or has its WiFi configuration is updated. Neither of these actions seem
   * dependent on this command function executing, however, so this method
   * exists only for completeness and is not used.
   * - It's not clear how this works with the NTP client that is configurable
   * via an AT/UDP command, since all UFOs have an NTP server setting.
   * - The response of this command always seems to be: 0x0f 0x10 0x00 0x1f.
   * @private
   */
  _time(callback: ?() => mixed): void {
    if (this._dead) return;
    // 0x10 yy yy mm dd hh mm ss 0x07 0x00
    // The first "yy" is the first 2 digits of the year.
    // The second "yy" is the last 2 digits of the year.
    // "mm" ranges from decimal "01" to "12".
    // "hh" is 24-hour format.
    // 0x07 0x00 seems to be a constant terminator for the data.
    const buf = Buffer.alloc(10);
    buf.writeUInt8(0x10, 0);
    const now = new Date();
    const first2Year = parseInt(now.getFullYear().toString().substring(0, 2), 10);
    const last2Year = parseInt(now.getFullYear().toString().substring(2), 10);
    buf.writeUInt8(first2Year, 1);
    buf.writeUInt8(last2Year, 2);
    buf.writeUInt8(now.getMonth() + 1, 3);
    buf.writeUInt8(now.getDate(), 4);
    buf.writeUInt8(now.getHours(), 5);
    buf.writeUInt8(now.getMinutes(), 6);
    buf.writeUInt8(now.getSeconds(), 7);
    buf.writeUInt8(0x07, 8);
    buf.writeUInt8(0, 9);
    this._write(_prepareBytes(buf), callback);
  }
  /**
   * Opens the TCP socket on this machine and connects to the UFO's TCP server,
   * then invokes the given callback.
   */
  connect(callback: ?() => mixed): void {
    if (this._dead) return;
    // Define options object.
    const options = {
      host: this._options.host,
      // All UFOs listen on the same port.
      port: 5577,
    };
    if (this._options.tcpPort && this._options.tcpPort > 0) {
      options.localPort = this._options.tcpPort;
    }
    // Connect.
    this._socket.connect(options, callback);
  }
  /**
   * Closes the TCP socket on this machine. This object cannot be used after
   * this method is called; invoking any method after this one results in a
   * silent no-op.
   */
  disconnect(): void {
    if (this._dead) return;
    // We're intentionally closing this connection.
    // Don't allow it to be used again.
    this._dead = true;
    this._socket.end();
    this._socket.emit('close');
  }
  /**
   * Gets the UFO's output status and sends it to the given callback.
   * The callback is guaranteed to have exactly one non-null argument.
   */
  status(callback: (error: ?Error, data: ?Object) => mixed): void {
    if (this._dead) return;
    this._socket.resume();
    this._statusCallback = function (err, data) {
      this._statusCallback = null;
      this._socket.pause();
      callback(err, data);
    }.bind(this);
    this._socket.write(statusRequest);
  }
  /** Turns the UFO output on, then invokes the given callback. */
  on(callback: ?() => mixed): void {
    if (this._dead) return;
    this._write(powerOn, callback);
  }
  /** Turns the UFO output off, then invokes the given callback. */
  off(callback: ?() => mixed): void {
    if (this._dead) return;
    this._write(powerOff, callback);
  }
  /**
   * Sets the UFO output to the static values specified, then invokes the given
   * calllback. The RGBW values are clamped from 0-255 inclusive, where 0 is off
   * and 255 is fully on/100% output.
   */
  rgbw(red: number, green: number, blue: number, white: number, callback: ?() => mixed): void {
    if (this._dead) return;
    // 0x31 rr gg bb ww 0x00
    // 0x00 seems to be a constant terminator for the data.
    const buf = Buffer.alloc(6);
    buf.writeUInt8(0x31, 0);
    buf.writeUInt8(_clampRGBW(red), 1);
    buf.writeUInt8(_clampRGBW(green), 2);
    buf.writeUInt8(_clampRGBW(blue), 3);
    buf.writeUInt8(_clampRGBW(white), 4);
    buf.writeUInt8(0, 5);
    this._write(_prepareBytes(buf), callback);
  }
  /**
   * Starts one of the UFO's built-in functions at the given speed, then invokes
   * the given callback. The error is always null unless an invalid function
   * name is given.
   * - The speed is clamped from 0-100 inclusive. 0 is ??? seconds and 100 is ??? seconds. Increasing the speed value by 1 shortens the time between transitions by ??? seconds.
   */
  builtin(name: BuiltinFunction, speed: number, callback: ?(error: ?Error) => mixed): void {
    if (this._dead) return;
    if (builtinFunctionMap.has(name)) {
      // 0x61 id speed
      const functionId = builtinFunctionMap.get(name) || noFunctionValue;
      const buf = Buffer.alloc(3);
      buf.writeUInt8(0x61, 0);
      buf.writeUInt8(functionId, 1);
      // This function accepts a speed from 0 (slow) to 100 (fast).
      buf.writeUInt8(_builtinFlipSpeed(speed), 2);
      this._write(_prepareBytes(buf), callback);
    } else if (callback) {
      callback(new Error(`No such built-in function ${name}`));
    }
  }
  /**
   * Starts the given custom function, then invokes the given callback. The
   * error is always null unless an invalid mode is given.
   * - The speed is clamped from 0-30 inclusive. 0 is ??? seconds and 30 is ??? seconds. Increasing the speed value by 1 shortens the time between transitions by ??? seconds.
   * - Only the first 16 steps in the given array are considered. Any additional
   * steps are ignored.
   * - If any null steps are specified in the array, they are dropped *before*
   * the limit of 16 documented above is considered.
   */
  custom(mode: CustomMode, speed: number, steps: Array<CustomStep>, callback: ?(error: ?Error) => mixed): void {
    if (this._dead) return;
    // Validate the mode.
    let modeId;
    switch (mode) {
      case 'gradual':
        modeId = 0x3A;
        break;
      case 'jumping':
        modeId = 0x3B;
        break;
      case 'strobe':
        modeId = 0x3C;
        break;
      default:
        if (callback) callback(new Error(`Invalid mode '${mode}'.`));
        return;
    }
    // 0x51 steps(16xUInt8) speed mode 0xFF
    // 0xFF seems to be a constant terminator for the data.
    const buf = Buffer.alloc(68);
    buf.writeUInt8(0x51, 0);
    let index = 1;
    // If there are fewer than 16 steps, "null" steps must be added so we have
    // exactly 16 steps. Additionally, any null steps intermingled with non-null
    // steps must be removed, as they will cause the pattern to stop. Null steps
    // can only exist at the end of the array.
    //
    // While we're doing this, truncate the array to the correct size.
    const stepsCopy = steps.filter(s => !_isNullStep(s)).slice(0, maxCustomSteps);
    while (stepsCopy.length < maxCustomSteps) {
      stepsCopy.push(nullStep);
    }
    // Each step consists of an RGB value and is translated into 4 bytes.
    // The 4th byte is always zero.
    stepsCopy.forEach((step) => {
      buf.writeUInt8(_clampRGBW(step.red), index);
      index += 1;
      buf.writeUInt8(_clampRGBW(step.green), index);
      index += 1;
      buf.writeUInt8(_clampRGBW(step.blue), index);
      index += 1;
      buf.writeUInt8(0, index);
      index += 1;
    });
    // This function accepts a speed from 0 (slow) to 30 (fast).
    // The UFO seems to store/report the speed as 1 higher than what it really is.
    buf.writeUInt8(_customFlipSpeed(speed) + 1, index);
    index += 1;
    // Set the mode.
    buf.writeUInt8(modeId, index);
    index += 1;
    // Add terminator and write.
    buf.writeUInt8(0xFF, index);
    this._write(_prepareBytes(buf), callback);
  }
  /** Returns the list of built-in functions usable by the API/CLI. */
  static getBuiltinFunctions(): Array<BuiltinFunction> {
    return Array.from(builtinFunctionMap.keys()).filter(k => !builtinFunctionReservedNames.includes(k)).sort();
  }
  /** Indicates whether or not the given object is equivalent to a null custom step. */
  static isNullStep(step: CustomStep): boolean { return _isNullStep(step); }
}
