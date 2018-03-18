// @flow
import * as util from 'util';
import * as dgram from 'dgram';
import _ from 'lodash';
import { Address4 } from 'ip-address';
import type { UfoOptions } from './UfoOptions';
import type { UfoDisconnectCallback } from './UfoDisconnectCallback';

/**
 * Details of a UFO found by {@link UdpClient.discover}.
 * @typedef {Object} DiscoveredUfo
 * @property {string} ip The IP address of the UFO.
 * @property {string} mac The MAC address of the UFO.
 * @property {string} model The free-form model number string reported by the
 * UFO.
 */
export type DiscoveredUfo = {
  ip: string,
  mac: string,
  model: string,
};
/**
 * {@link UdpClient.discover} options.
 * @typedef {Object} UfoDiscoverOptions
 * @property {number} [timeout] How long to wait for UFOs to respond, in
 * milliseconds. Default is 3000.
 * @property {string} [password] The UDP password to use when searching for
 * UFOs. If unspecified, the default password is used.
 * @property {number} [remotePort] The UDP port to which expected UFOs are
 * bound. If unspecified, the default port 48899 is used.
 * @property {number} [localPort] The UDP port bound on this machine to perform
 * the UFO search. If unspecified, a random port is used.
 * @property {string} [localAddress] The local host used for establishing the
 * UDP socket.
 */
export type UfoDiscoverOptions = {
  timeout: ?number,
  password: ?string,
  remotePort: ?number,
  localPort: ?number,
  localAddress: ?string,
};
/**
 * A callback function that receives an array of discovered UFOs.
 * @callback
 * @param {Error} [error] Possibly-null error object.
 * @param {Array<DiscoveredUfo>} ufos The list of UFOs that were discovered; may
 * be empty.
 */
export type UdpDiscoverCallback = (error: ?Error, ufos: Array<DiscoveredUfo>) => void;
/**
 * A WiFi network discovered by the {@link UdpClient#doWifiScan} method.
 * @typedef {Object} WifiNetwork
 * @property {number} channel The network channel number, 1-11 inclusive.
 * @property {string} [ssid] The SSID of the network. If null, SSID broadcast is
 * disabled for this network.
 * @property {string} mac The MAC address of this network's AP.
 * @property {string} security A description of the security configuration for
 * this network.
 * @property {number} strength The network signal strength, 0-100 inclusive.
 */
export type WifiNetwork = {
  channel: number,
  ssid: string | null,
  mac: string,
  security: string,
  strength: number
};

/* Private types. */
type UdpOptions = {
  host: string,
  password: string,
  remotePort: number,
  localPort: number,
  localAddress?: string,
};
type UdpCommand = {
  cmd: string,
  literal?: boolean,
  get?: string | Array<string>,
}
type UdpCommandReceiveParser = (string) => Array<string>;
type UdpCommandSchema = {
  send: string,
  recv: UdpCommandReceiveParser,
};
type UdpCommandReceiveCallback = (Error | null, (string | Array<string>)) => void;

/* Private variables. */
const defaultPort = 48899;
// Milliseconds.
const discoverTimeout = 3000;
const ack = '+ok';
const sendPrefix = 'AT+';
const sendSuffix = '\r';
const recvPrefix = ack;
const recvSuffix = '\r\n\r\n';
const defaultHello = 'HF-A11ASSISTHREAD';
const errAck = '+ERR';
const commandMap: Map<string, UdpCommand> = new Map([
  /*
   * Common commands
   */
  ['hello', {
    // getter-only
    // arg 1 is IP address
    // arg 2 is MAC address
    // arg 3 is model number
    cmd: defaultHello,
    literal: true,
    get: [],
  }],
  ['helloAck', {
    // getter-only
    cmd: ack,
    literal: true,
  }],
  ['reboot', {
    // getter-only
    cmd: 'Z',
  }],
  ['factoryReset', {
    // getter-only
    cmd: 'RELD',
    get: 'rebooting...',
  }],
  ['moduleVersion', {
    // getter-only
    // arbitrary string
    cmd: 'VER',
    get: [],
  }],
  ['ntp', {
    // arg 1 is IP address, default is 61.164.36.105
    cmd: 'NTPSER',
    get: [],
  }],
  ['udpPassword', {
    // password must be 20 characters or less
    cmd: 'ASWD',
    get: [],
  }],
  ['tcpServer', {
    // arg 1 is "TCP" or "UDP"
    // arg 2 is "Client" or "Server"
    // arg 3 is port number
    // arg 4 is IP address
    cmd: 'NETP',
    get: [],
  }],
  ['wifiAutoSwitch', {
    // Determines how long the module will wait with no client WiFi connection
    // before it switches to AP mode. Exactly 1 argument.
    //
    // "off": disabled; AP mode will never be turned on
    // "on" 1 minute
    // "auto": 10 minutes
    // 3-120: X minutes
    cmd: 'MDCH',
    get: [],
  }],
  ['wifiMode', {
    // arg 1 is "AP", "STA" or "APSTA"
    cmd: 'WMODE',
    get: [],
  }],
  ['wifiScan', {
    // getter-only
    // This command actually returns multiple lines, but no special handling is required for that.
    cmd: 'WSCAN',
    get: [],
  }],
  // Not documented, nor does it show up in AT+H output, but it seems to
  // ease sending multiple commands in sequence. It appears to be some sort
  // of command terminator.
  ['endCmd', {
    // getter-only
    cmd: 'Q',
  }],
  /*
   * Wifi AP commands
   */
  ['wifiApIp', {
    // arg 1 is IP address
    // arg 2 is netmask
    cmd: 'LANN',
    get: [],
  }],
  ['wifiApBroadcast', {
    // arg 1 is "11B", "11BG" or "11BGN"
    // arg 2 is SSID, 32 characters or less
    // arg 3 is "CH1" thru "CH11"
    cmd: 'WAP',
    get: [],
  }],
  ['wifiApAuth', {
    // arg 1 (auth) is "OPEN" or "WPA2PSK"
    // arg 2 (encryption) is "NONE" or "AES"
    // arg 3 (passphrase) is an ASCII string between 8 and 63 characters, inclusive
    cmd: 'WAKEY',
    get: [],
  }],
  ['wifiApLed', {
    // arg 1 is "on" or "off"
    cmd: 'WALKIND',
    get: [],
  }],
  ['wifiApDhcp', {
    // arg 1 is "on" or "off"
    // arg 2 is start octet
    // arg 3 is end octet
    cmd: 'WADHCP',
    get: [],
  }],
  /*
   * WiFi client commands
   */
  ['wifiClientApInfo', {
    // getter-only
    // arg 1 is the literal string "Disconnected" or the variable string "SSID(MAC)"
    cmd: 'WSLK',
    get: [],
  }],
  ['wifiClientApSignal', {
    // getter-only
    // arg 1 is the literal string "Disconnected" or an arbitrary string
    cmd: 'WSLQ',
    get: [],
  }],
  ['wifiClientIp', {
    // arg 1 is "static" or "DHCP"
    // arg 2 is IP address
    // arg 3 is netmask
    // arg 4 is gateway
    cmd: 'WANN',
    get: [],
  }],
  ['wifiClientSsid', {
    // arg 1 is SSID, 32 characters or less
    cmd: 'WSSSID',
    get: [],
  }],
  ['wifiClientAuth', {
    // arg 1 (auth) is "OPEN", "SHARED", "WPAPSK" or "WPA2PSK"
    // arg 2 (encryption) is:
    // - "NONE", only when auth is "OPEN"
    // - "WEP-H" (hex), only when auth is "OPEN" or "SHARED"
    // - "WEP-A" (ascii), only when auth is "OPEN" or "SHARED"
    // - "TKIP", only when auth is "WPAPSK" or "WPA2PSK"
    // - "AES", only when auth is "WPAPSK" or "WPA2PSK"
    // arg 3 (passphrase) is:
    // - if encryption is "WEP-H", must be a hex-as-ASCII string of length 10 or 26
    // - if encryption is "WEP-A", must be an ASCII string of length 5 or 13
    // - if encryption is "TKIP" or "AES", must be an ASCII string between 8 and 63 characters, inclusive
    cmd: 'WSKEY',
    get: [],
  }],
]);

/* Private functions. */
const _macAddress = function (mac: string): string {
  return mac.toLowerCase().replace(/[-:]/g, '').replace(/(.{2})/g, '$1:').slice(0, -1);
};
const _parseHelloResponse = function (response: string | Array<string>): DiscoveredUfo {
  let splitResponse = response;
  if (!Array.isArray(splitResponse)) splitResponse = splitResponse.split(',');
  return {
    ip: splitResponse[0],
    mac: _macAddress(splitResponse[1]),
    model: splitResponse[2],
  };
};
const _udpCommandReceiveParser = function (response: string): Array<string> {
  let result = response;
  // Chop response prefix/suffix, if they exist.
  if (result.startsWith(recvPrefix)) result = result.substring(recvPrefix.length);
  if (result.startsWith('=')) result = result.substring(1);
  if (result.endsWith(recvSuffix)) result = result.substring(0, result.length - recvPrefix.length);
  result = result.trim();
  if (result === '') return [];
  if (Array.isArray(this)) return result.split(',');
  if (_.isString(this)) return [result];
  return [];
};
const _assembleCommand = function (name: string, ...setArgs: Array<string>): UdpCommandSchema {
  // Define the command object.
  const command = commandMap.get(name);
  if (command !== undefined) {
    let cmdString = command.cmd;
    const mode = setArgs.length > 0 ? 'set' : 'get';
    // Commands flagged at literal have no syntax translation whatsoever.
    if (!command.literal) {
      // Non-literal commands are wrapped in the send prefix/suffix.
      cmdString = sendPrefix + cmdString;
      // Set commands have their argument list prior to the send suffix.
      if (mode === 'set') {
        cmdString += `=${setArgs.join(',')}`;
      }
      cmdString += sendSuffix;
    }
    // Return the send and receive schema.
    return {
      send: cmdString,
      recv: _udpCommandReceiveParser.bind(mode === 'get' ? command.get : false),
    };
  }
  return { send: '', recv: _udpCommandReceiveParser.bind(false) };
};
const _asArray = function (value: string | Array<string>): Array<string> {
  if (Array.isArray(value)) return value;
  return [value];
};

/** Provides an API to UFOs for interacting with the UFO's UDP server. */
export default class {
  _ufo: Object;
  _options: UdpOptions;
  _dead: boolean;
  _socket: dgram$Socket;
  _error: ?Error;
  _receiveCallback: ?UdpCommandReceiveCallback;
  _receiveParser: ?UdpCommandReceiveParser;
  constructor(ufo: Object, options: UfoOptions) {
    this._ufo = ufo;
    const optionsBuilder = {};
    optionsBuilder.host = options.host;
    optionsBuilder.password = options.password || defaultHello;
    optionsBuilder.remotePort = options.remoteUdpPort || defaultPort;
    optionsBuilder.localPort = options.localUdpPort || -1;
    optionsBuilder.localAddress = options.localHost || undefined;
    this._options = optionsBuilder;
    // Flag that tracks the state of this socket.
    this._dead = false;
    // Define the UDP socket.
    this._socket = dgram.createSocket('udp4');
    this._error = null;
    // Route received messages to whatever the current callback is.
    this._receiveCallback = null;
    this._receiveParser = null;
    this._socket.on('message', (msg, rinfo) => { // eslint-disable-line no-unused-vars
      // Don't do anything if we've had a socket error.
      if (!this._error) {
        let message = '';
        let error = null;
        // Determine if we had a protocol/syntax error.
        if (message.startsWith(errAck)) {
          const code = message.substring(message.indexOf('=') + 1).trim();
          let errorMsg = 'Unknown error';
          switch (code) {
            case '-1':
              errorMsg = 'Invalid command format (%s)';
              break;
            case '-2':
              errorMsg = 'Invalid command (%s)';
              break;
            case '-3':
              errorMsg = 'Invalid operation symbol (%s)';
              break;
            case '-4':
              errorMsg = 'Invalid parameter (%s)';
              break;
            case '-5':
              errorMsg = 'Operation not permitted (%s)';
              break;
            default:
              break;
          }
          error = new Error(util.format(errorMsg, code));
        } else {
          // Convert all messages to UTF-8 because UFOs always send ASCII.
          message = msg.toString('utf8') || '';
          // Parse this message and collapse it if possible.
          const parser = this._receiveParser;
          if (parser) {
            message = parser(message);
            if (message.length === 0) {
              message = '';
            } else if (message.length === 1) {
              message = message[0]; // eslint-disable-line prefer-destructuring
            }
          } else {
            error = new Error('No receive parser provided; this is a bug.');
          }
        }
        // Invoke the callback.
        const callback = this._receiveCallback;
        if (callback) callback(error, message);
      }
    });
    // Capture socket errors so we can respond appropriately.
    // These are not AT command errors; we handle those separately.
    this._socket.on('error', (err) => {
      this._dead = true;
      this._error = err;
      this._socket.close();
    });
    // The socket has been closed; react appropriately.
    this._socket.on('close', () => {
      this._socket.unref();
      this._ufo.emit('udpDead', this._error);
    });
  }
  /**
   * Searches for UFOs on the network and invokes the given callback with the
   * resulting list.
   */
  static discover(options: UfoDiscoverOptions, callback: UdpDiscoverCallback): void {
    // Return variables.
    let error = null;
    const data = [];
    // Set the default password if none was given.
    const hello = Buffer.from(options.password ? options.password : defaultHello);
    // Set the default timeout if none was given.
    let timeout = options.timeout || -1;
    if (timeout < 0) timeout = discoverTimeout;
    // Set the default remote port if none was given.
    let remotePort = options.remotePort || -1;
    if (remotePort < 0) remotePort = defaultPort;
    // Setup the socket. Let Node exit if this socket is still active.
    let stopDiscover: ?TimeoutID = null;
    const socket: dgram$Socket = dgram.createSocket('udp4');
    socket.unref();
    // Define the listener's event handlers.
    socket.on('close', () => {
      if (stopDiscover) clearTimeout(stopDiscover);
      callback(error, data);
    });
    socket.on('error', (err) => {
      if (stopDiscover) clearTimeout(stopDiscover);
      error = err;
      socket.close();
    });
    socket.on('message', (msg, rinfo) => { // eslint-disable-line no-unused-vars
      if (!error) {
        const message = msg.toString('utf8');
        // The socket sends itself the request message. Ignore this.
        if (message !== hello) {
          // Add the result to our array.
          data.push(_parseHelloResponse(message));
        }
      }
    });
    // Send the request and start listening for responses.
    const closeSocket = function () { socket.close(); };
    socket.on('listening', () => {
      socket.setBroadcast(true);
      socket.send(hello, remotePort, '255.255.255.255', (err) => {
        if (err) socket.emit('error', err);
        else stopDiscover = setTimeout(closeSocket, timeout);
      });
    });
    // Use the specified port, or a random one.
    // Also use the given local address, or none if not specified.
    let port = 0;
    if (options.localPort && options.localPort > 0) port = options.localPort;
    socket.bind(port, options.localAddress || undefined);
  }
  /*
   * Private methods
   */
  /**
   * Sends the given command to the UFO and runs the callback once the message
   * is sent. This method is suitable for commands that do not send responses.
   * @private
   */
  _send(cmd: UdpCommandSchema, callback: (?Error) => void): void {
    this._socket.send(Buffer.from(cmd.send), defaultPort, this._options.host, callback);
  }
  /**
   * Sends the given command to the UFO and runs the callback whenever any data
   * is received from the UFO. The callback has a possibly-null error and a
   * non-null, possibly-empty result.
   * @private
   */
  _sendAndWait(cmd: UdpCommandSchema, callback: UdpCommandReceiveCallback): void {
    this._receiveCallback = callback;
    this._receiveParser = cmd.recv;
    this._socket.send(Buffer.from(cmd.send), defaultPort, this._options.host, (err) => {
      if (err) callback(err, '');
    });
  }
  /**
   * Puts the UFO in command mode. If this method fails, the UFO object is
   * disconnected with an error.
   * @private
   */
  _commandMode(callback: () => void): void {
    if (this._dead) return;
    // Say hello.
    const cmd = _assembleCommand('hello');
    if (this._options.password) cmd.send = this._options.password;
    this._sendAndWait(cmd, (err, msg) => {
      if (err) {
        // Give up if we couldn't say hello.
        if (err) this._socket.emit('error', err);
      } else {
        // Give up if the response did not come from the expected IP.
        // 0.0.0.0 occurs when connected to a UFO in AP mode.
        const ufo = _parseHelloResponse(msg || '');
        if (ufo.ip === this._options.host || ufo.ip === '0.0.0.0') {
          // Switch to command mode.
          this._send(_assembleCommand('helloAck'), function (err2) {
            // Give up if we couldn't switch to command mode.
            // Otherwise fire the callback.
            if (err2) this._socket.emit('error', err2);
            else callback();
          });
        } else {
          this._socket.emit('error', new Error(`Received hello response from unexpected host: ${JSON.stringify(ufo)}`));
        }
      }
    });
  }
  /**
   * Sends the "AT+Q\r" message, ending command transmission and preparing for
   * future commands to be sent.
   * @private
   */
  _endCommand(callback: () => void): void {
    if (this._dead) return;
    this._send(_assembleCommand('endCmd'), (err) => {
      if (err) this._socket.emit('error', err);
      else callback();
    });
  }
  /**
   * Puts the UFO in command mode, sends the given command to the UFO and runs
   * the callback once a single response is received from the UFO. The callback
   * has a possibly-null error and a non-null, possibly-empty result.
   * @private
   */
  _runCommand(cmd: UdpCommandSchema, callback: UdpCommandReceiveCallback): void {
    if (this._dead) return;
    this._commandMode(() => { this._sendAndWait(cmd, callback); });
  }
  /**
   * Puts the UFO in command mode, sends the given command to the UFO and runs
   * the callback once a single response is received from the UFO. The callback
   * has a possibly-null error and a non-null, possibly-empty result. The "end"
   * command is sent to the UFO before the callback is invoked.
   * @private
   */
  _runCommandWithResponse(cmd: UdpCommandSchema, callback: UdpCommandReceiveCallback): void {
    if (this._dead) return;
    this._runCommand(cmd, (err, result) => {
      this._endCommand(() => callback(err, result));
    });
  }
  /**
   * Puts the UFO in command mode, sends the given command to the UFO and runs
   * the callback once a single response is received from the UFO. The callback
   * has a possibly-null error and an empty string result. The "end" command is
   * sent to the UFO before the callback is invoked.
   * @private
   */
  _runCommandNoResponse(cmd: UdpCommandSchema, callback: ?UdpCommandReceiveCallback): void {
    if (this._dead) return;
    this._runCommandWithResponse(cmd, (err, result) => { // eslint-disable-line no-unused-vars
      if (callback) {
        if (err) callback(err, '');
        else callback(null, '');
      }
    });
  }
  /*
   * Core methods
   */
  /** Binds the UDP socket on this machine, then invokes the given callback. */
  connect(callback: ?() => void): void {
    if (this._dead) return;
    let port = 0;
    if (this._options.localPort > 0) port = this._options.localPort;
    if (callback) this._socket.bind(port, this._options.localAddress, callback);
    else this._socket.bind(port, this._options.localAddress);
  }
  /**
   * Closes the UDP socket on this machine. The disconnect callback, if defined
   * when this client was constructed, will be invoked.
   */
  disconnect(): void {
    if (this._dead) return;
    // We're intentionally closing this connection.
    // Don't allow it to be used again.
    this._dead = true;
    this._socket.close();
  }
  /** Returns the UFO's hardware/firmware version. */
  version(callback: (?Error, string) => void): void {
    this._runCommandWithResponse(_assembleCommand('moduleVersion'), (err, version) => {
      callback(err, String(version));
    });
  }
  /**
   * Reboots the UFO. The owning UFO object will be disconnected after this
   * method is invoked. If a callback is provided to this method, it overrides
   * whatever disconnect callback was defined when the client was constructed.
   */
  reboot(callback?: UfoDisconnectCallback): void {
    // Override the callback if requested.
    if (callback) this._ufo._disconnectCallback = callback;
    // Reboot and disconnect.
    // We cannot use _runCommand here because we wiill not receive any response.
    this._commandMode(() => {
      this._send(_assembleCommand('reboot'), (err) => {
        if (err) this._socket.emit('error', err);
        else this._ufo.disconnect();
      });
    });
  }
  /**
   * Resets the UFO to factory defaults. The owning UFO object will be
   * disconnected after this method is invoked. If a callback is provided to
   * this method, it overrides whatever disconnect callback was defined when the
   * client was constructed.
   */
  factoryReset(callback?: UfoDisconnectCallback): void {
    // Override the callback if requested.
    if (callback) this._ufo._disconnectCallback = callback;
    // Request a factory reset.
    // This command implies a reboot, so no explicit reboot command is needed.
    let expected = commandMap.get('factoryReset');
    if (expected) expected = expected.get;
    this._runCommand(_assembleCommand('factoryReset'), (err, resp) => {
      // Emit the receive error, or...
      // Emit an error if the response did not match, or...
      // Fire the callback with the response.
      if (err) {
        this._socket.emit('error', err);
      } else if (resp === expected) {
        this._ufo.disconnect();
      } else {
        const response = String(resp) || 'null';
        this._socket.emit('error', new Error(`Unexpected response: ${response}`));
      }
    });
  }
  /** Returns the NTP server IP address. */
  getNtpServer(callback: (?Error, string) => void): void {
    this._runCommandWithResponse(_assembleCommand('ntp'), (err, ipAddress) => {
      callback(err, String(ipAddress));
    });
  }
  /** Sets the NTP server IP address. */
  setNtpServer(ipAddress: string, callback: ?(?Error) => void): void {
    if (!new Address4(ipAddress).isValid()) {
      if (callback) callback(new Error(`Invalid IP address provided: ${ipAddress}.`));
      return;
    }
    this._runCommandNoResponse(_assembleCommand('ntp', ipAddress), callback);
  }
  /** Returns the UDP password. */
  getUdpPassword(callback: (?Error, string) => void): void {
    this._runCommandWithResponse(_assembleCommand('udpPassword'), (err, password) => {
      callback(err, String(password));
    });
  }
  /**
   * Sets the UDP password. If an error occurs while executing this command,
   * the owning UFO object will be disconnected and the given callback (if any)
   * will override whatever disconnect callback was previously defined.
   */
  setUdpPassword(password: string, callback: ?(?Error) => void): void {
    if (password.length > 20) {
      if (callback) callback(new Error(`Password is ${password.length} characters long, exceeding limit of 20.`));
      return;
    }
    this._runCommand(_assembleCommand('udpPassword', password), (err) => {
      if (err) {
        // If this command fails, we have no way of knowing whether or not
        // the password was actually set, so we have to assume that this object
        // can no longer communicate with the UFO.
        if (callback) this._ufo._disconnectCallback = callback;
        this._socket.emit('error', err);
      } else {
        // Update the password in the options object so we can continue
        // using this client to communicate.
        this._options.password = password;
        if (callback) callback();
      }
    });
  }
  /** Returns the TCP port. */
  getTcpPort(callback: (?Error, number) => void): void {
    this._runCommandWithResponse(_assembleCommand('tcpServer'), (err, tcpServer) => {
      callback(err, parseInt(_asArray(tcpServer)[2], 10));
    });
  }
  /**
   * Sets the TCP port. The owning UFO object will be disconnected after this
   * method is invoked. If a callback is provided to this method, it overrides
   * whatever disconnect callback was defined when the client was constructed.
   */
  setTcpPort(port: number, callback?: UfoDisconnectCallback): void {
    this._commandMode(() => {
      this._sendAndWait(_assembleCommand('tcpServer'), (err, tcpServer) => {
        if (err && callback) callback(err);
        else {
          const cleanPort = _.clamp(port, 0, 65535);
          // Override the callback if requested.
          if (callback) this._ufo._disconnectCallback = callback;
          this._sendAndWait(_assembleCommand('tcpServer', tcpServer[0], tcpServer[1], cleanPort, tcpServer[3]), (err2) => {
            if (err2) this._socket.emit('error', err2);
            else this._ufo.disconnect();
          });
        }
      });
    });
  }
  /**
   * Returns the WiFi "auto-switch" setting, which is one of the following:
   * - "off", which means auto-switch is disabled.
   * - "on", which means 1 minutes.
   * - "auto", which means 10 minutes.
   * - The number of minutes, 3-120 inclusive.
   *
   * If auto-switch is anything but "off", and if the UFO fails to connect to
   * its client AP or otherwise enters any abnormal state, the UFO will reset
   * itself and enable its AP mode after the specified number of minutes have
   * passed.
   *
   * Note that this method always returns a string even if the value is a
   * number.
   */
  getWifiAutoSwitch(callback: (?Error, string) => void): void {
    this._runCommandWithResponse(_assembleCommand('wifiAutoSwitch'), (err, value) => {
      callback(err, String(value));
    });
  }
  /**
   * Sets the WiFi "auto-switch" setting, which is one of the following:
   * - "off", which means auto-switch is disabled.
   * - "on", which means 1 minutes.
   * - "auto", which means 10 minutes.
   * - The number of minutes, 3-120 inclusive.
   *
   * If auto-switch is anything but "off", and if the UFO fails to connect to
   * its client AP or otherwise enters any abnormal state, the UFO will reset
   * itself and enable its AP mode after the specified number of minutes have
   * passed.
   */
  setWifiAutoSwitch(value: 'off' | 'on' | 'auto' | number, callback: ?(?Error) => void): void {
    let error = false;
    const intValue = parseInt(value, 10);
    if (isNaN(intValue)) { // eslint-disable-line no-restricted-globals
      switch (value) {
        case 'off':
        case 'on':
        case 'auto':
          break;
        default:
          error = true;
          break;
      }
    } else {
      error = intValue < 3 || intValue > 120;
    }
    if (error) {
      if (callback) callback(new Error(`Invalid value ${value}, must be "off", "on", "auto" or 3-120 inclusive.`));
      return;
    }
    this._runCommandNoResponse(_assembleCommand('wifiAutoSwitch', value.toString()), callback);
  }
  /**
   * Returns the WiFi mode:
   * - "AP" (AP mode)
   * - "STA" (client mode)
   * - "APSTA" (client and AP mode)
   */
  getWifiMode(callback: (?Error, string) => void): void {
    this._runCommandWithResponse(_assembleCommand('wifiMode'), (err, mode) => {
      callback(err, String(mode));
    });
  }
  /**
   * Sets the WiFi mode:
   * - "AP" (AP mode)
   * - "STA" (client mode)
   * - "APSTA" (client and AP mode)
   */
  setWifiMode(mode: 'AP' | 'STA' | 'APSTA', callback: ?(?Error) => void): void {
    switch (mode) {
      case 'AP':
      case 'STA':
      case 'APSTA':
        break;
      default:
        if (callback) callback(new Error(`Invalid mode ${mode}, must be "AP", "STA" or "APSTA".`));
        return;
    }
    this._runCommandNoResponse(_assembleCommand('wifiMode', mode), callback);
  }
  /** Performs a WiFi AP scan from the UFO and returns the results. */
  doWifiScan(callback: (?Error, Array<WifiNetwork>) => void): void {
    const resultArray = [];
    let headerReceived = false;
    let errorReceived = false;
    this._runCommand(_assembleCommand('wifiScan'), (err, result) => {
      if (!errorReceived) {
        if (err) {
          errorReceived = true;
          this._endCommand(() => callback(err, []));
        } else if (!headerReceived) {
          headerReceived = true;
        } else if (Array.isArray(result)) {
          // Each line in the output has a \n. It appears to be silently swallowed
          // by the receiver function, which is fine because we don't want it anyway.
          resultArray.push({
            channel: parseInt(result[0], 10),
            ssid: result[1] || null,
            mac: _macAddress(result[2]),
            security: result[3],
            strength: parseInt(result[4], 10),
          });
        } else {
          this._endCommand(() => callback(null, resultArray));
        }
      }
    });
  }
  /*
   * AP WiFi methods
   */
  /** Returns the IP address and netmask of the UFO AP. */
  getWifiApIp(callback: (?Error, ?{ip: string, mask: string}) => void): void {
    this._runCommandWithResponse(_assembleCommand('wifiApIp'), (err, result) => {
      if (err) callback(err, null);
      else {
        const resultArray = _asArray(result);
        callback(null, {
          ip: resultArray[0],
          mask: resultArray[1],
        });
      }
    });
  }
  /** Sets the IP address and netmask of the UFO AP. */
  setWifiApIp(ip: string, mask: string, callback: ?(?Error) => void): void {
    if (!new Address4(ip).isValid()) {
      if (callback) callback(new Error(`Invalid IP address provided: ${ip}.`));
      return;
    }
    if (!new Address4(mask).isValid()) {
      if (callback) callback(new Error(`Invalid subnet mask provided: ${mask}.`));
      return;
    }
    this._runCommandNoResponse(_assembleCommand('wifiApIp', ip, mask), callback);
  }
  /** Returns the UFO AP's broadcast information. Channel is 1-11 inclusive. */
  getWifiApBroadcast(callback: (?Error, ?{mode: 'b' | 'bg' | 'bgn', ssid: string, channel: number}) => void): void {
    this._runCommandWithResponse(_assembleCommand('wifiApBroadcast'), (err, result) => {
      if (err) callback(err, null);
      else {
        const resultArray = _asArray(result);
        let mode;
        const rawMode = resultArray[0];
        switch (rawMode.toLowerCase()) {
          case '11b':
            mode = 'b';
            break;
          case '11bg':
            mode = 'bg';
            break;
          case '11bgn':
            mode = 'bgn';
            break;
          default:
            callback(new Error(`Impossible AP mode: ${rawMode}`), null);
            return;
        }
        const ssid = resultArray[1];
        const channel = parseInt(resultArray[2].substring(2), 10);
        callback(null, { mode, ssid, channel });
      }
    });
  }
  /** Sets the UFO AP's broadcast information. Channel is 1-11 inclusive. */
  setWifiApBroadcast(mode: 'b' | 'bg' | 'bgn', ssid: string, channel: number, callback: ?(?Error) => void): void {
    if (ssid.length > 32) {
      if (callback) callback(new Error(`SSID is ${ssid.length} characters long, exceeding limit of 32.`));
      return;
    }
    const cleanChannel = _.clamp(channel, 1, 11);
    this._runCommandNoResponse(_assembleCommand('wifiApBroadcast', `11${mode.toUpperCase()}`, ssid, `CH${cleanChannel}`), callback);
  }
  /** Returns the UFO AP's passphrase. If null, AP network is open. */
  getWifiApPassphrase(callback: (?Error, ?string) => void): void {
    this._runCommandWithResponse(_assembleCommand('wifiApAuth'), (err, result) => {
      const resultArray = _asArray(result);
      callback(err, resultArray[0] === 'OPEN' ? null : resultArray[2]);
    });
  }
  /** Sets the UFO's AP passphrase. If null, network will be open. */
  setWifiApPassphrase(passphrase: string | null, callback: ?(?Error) => void): void {
    let cmd;
    if (passphrase === null) {
      cmd = _assembleCommand('wifiApAuth', 'OPEN', 'NONE');
    } else if (passphrase.length < 8 || passphrase.length > 63) {
      if (callback) callback(new Error(`Passphrase is ${passphrase.length} characters long, must be 8-63 characters inclusive.`));
      return;
    } else {
      cmd = _assembleCommand('wifiApAuth', 'WPA2PSK', 'AES', passphrase);
    }
    this._runCommandNoResponse(cmd, callback);
  }
  /**
   * Returns the UFO AP's connection LED flag. If on, the UFO's blue LED will
   * turn on when any client is connected to the AP.
   */
  getWifiApLed(callback: (?Error, boolean) => void): void {
    this._runCommandWithResponse(_assembleCommand('wifiApLed'), (err, result) => {
      callback(err, String(result) === 'on');
    });
  }
  /**
   * Sets the UFO AP's connection LED flag. If on, the UFO's blue LED will turn
   * on when any client is connected to the AP.
   */
  setWifiApLed(on: boolean, callback: ?(?Error) => void): void {
    this._runCommandNoResponse(_assembleCommand('wifiApLed', on ? 'on' : 'off'), callback);
  }
  /**
   * Returns the UFO AP's DHCP server settings. If DHCP is on, the returned
   * object's "start" and "end" properties will be 0-254 inclusive.
   */
  getWifiApDhcp(callback: (?Error, ?{on: boolean, start?: number, end?: number}) => void): void {
    this._runCommandWithResponse(_assembleCommand('wifiApDhcp'), (err, result) => {
      if (err) callback(err, null);
      else {
        const resultArray = _asArray(result);
        const dhcp = {};
        dhcp.on = resultArray[0] === 'on';
        if (dhcp.on) {
          dhcp.start = parseInt(resultArray[1], 10);
          dhcp.end = parseInt(resultArray[2], 10);
        }
        callback(null, dhcp);
      }
    });
  }
  /**
   * Sets the UFO AP's DHCP address range. Both arguments are 0-254 inclusive.
   * This command implicitly enables the DHCP server.
   */
  setWifiApDhcp(start: number, end: number, callback: ?(?Error) => void): void {
    const cleanStart = _.clamp(start, 0, 254);
    const cleanEnd = _.clamp(start, 0, 254);
    this._runCommandNoResponse(_assembleCommand('wifiApDhcp', 'on', cleanStart, cleanEnd), callback);
  }
  /** Disables the UFO AP's DHCP server. */
  disableWifiApDhcp(callback: ?(?Error) => void): void {
    this._runCommandNoResponse(_assembleCommand('wifiApDhcp', 'off'), callback);
  }
  /*
   * Client WiFi methods
   */
  /**
   * Returns the UFO client's AP SSID and MAC address. If the UFO is not
   * connected to any AP, the returned object will be null.
   */
  getWifiClientApInfo(callback: (?Error, ?{ssid: string, mac: string}) => void): void {
    this._runCommandWithResponse(_assembleCommand('wifiClientApInfo'), (err, result) => {
      if (err) callback(err, null);
      else {
        const realResult = String(result);
        if (realResult === 'Disconnected') {
          callback(null, null);
        } else {
          const match = realResult.match(/(.{1,32})\(([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})\)/i) || [];
          if (match.length < 2) callback(null, null);
          else callback(null, { ssid: match[1], mac: _macAddress(match[2]) });
        }
      }
    });
  }
  /** Returns the UFO client's AP signal strength, as seen by the UFO. */
  getWifiClientApSignal(callback: (?Error, string) => void): void {
    this._runCommandWithResponse(_assembleCommand('wifiClientApSignal'), (err, result) => {
      const resultArray = _asArray(result);
      callback(err, resultArray.join(','));
    });
  }
  /** Returns the UFO client's IP configuration. */
  getWifiClientIp(callback: (?Error, ?{dhcp: boolean, ip: string, mask: string, gateway: string}) => void): void {
    this._runCommandWithResponse(_assembleCommand('wifiClientIp'), (err, result) => {
      const resultArray = _asArray(result);
      if (err) callback(err, null);
      else {
        callback(null, {
          dhcp: resultArray[0] === 'DHCP',
          ip: resultArray[1],
          mask: resultArray[2],
          gateway: resultArray[3],
        });
      }
    });
  }
  /** Enables DHCP mode for the UFO client. */
  setWifiClientIpDhcp(callback: ?(?Error) => void): void {
    this._runCommandNoResponse(_assembleCommand('wifiClientIp', 'DHCP'), callback);
  }
  /** Sets the IP configuration for the UFO client. Implicitly disables DHCP. */
  setWifiClientIpStatic(ip: string, mask: string, gateway: string, callback: ?(?Error) => void): void {
    if (!new Address4(ip).isValid()) {
      if (callback) callback(new Error(`Invalid IP address provided: ${ip}.`));
      return;
    }
    if (!new Address4(mask).isValid()) {
      if (callback) callback(new Error(`Invalid subnet mask provided: ${mask}.`));
      return;
    }
    if (!new Address4(gateway).isValid()) {
      if (callback) callback(new Error(`Invalid gateway provided: ${gateway}.`));
      return;
    }
    this._runCommandNoResponse(_assembleCommand('wifiClientIp', 'static', ip, mask, gateway), callback);
  }
  /** Returns the UFO client's AP SSID. */
  getWifiClientSsid(callback: (?Error, string) => void): void {
    this._runCommandWithResponse(_assembleCommand('wifiClientSsid'), (err, result) => {
      callback(err, String(result));
    });
  }
  /** Sets the UFO client's AP SSID. */
  setWifiClientSsid(ssid: string, callback: ?(?Error) => void): void {
    if (ssid.length > 32) {
      if (callback) callback(new Error(`SSID is ${ssid.length} characters long, exceeding limit of 32.`));
      return;
    }
    this._runCommandNoResponse(_assembleCommand('wifiClientSsid', ssid), callback);
  }
  /** Returns the UFO client's AP auth settings. */
  getWifiClientAuth(callback: (?Error, ?{auth: string, encryption: string, passphrase: string | null}) => void): void {
    this._runCommandWithResponse(_assembleCommand('wifiClientAuth'), (err, result) => {
      if (err) callback(err, null);
      else {
        const resultArray = _asArray(result);
        callback(null, {
          auth: resultArray[0],
          encryption: resultArray[1],
          passphrase: resultArray[2] || null,
        });
      }
    });
  }
  /** Sets the UFO client's AP auth settings. */
  setWifiClientAuth(
    auth: 'OPEN' | 'SHARED' | 'WPAPSK' | 'WPA2PSK',
    encryption: 'NONE' | 'WEP-H' | 'WEP-A' | 'TKIP' | 'AES',
    passphrase?: string | null,
    callback: ?(?Error) => void,
  ): void {
    if (auth === 'OPEN') {
      switch (encryption) {
        case 'NONE':
        case 'WEP-H':
        case 'WEP-A':
          break;
        default:
          if (callback) callback(new Error(`Invocation error: auth is OPEN but unsupported encryption ${encryption} provided.`));
          return;
      }
    } else if (auth === 'SHARED') {
      switch (encryption) {
        case 'WEP-H':
        case 'WEP-A':
          break;
        default:
          if (callback) callback(new Error(`Invocation error: auth is SHARED but unsupported encryption ${encryption} provided.`));
          return;
      }
    } else {
      switch (encryption) {
        case 'TKIP':
        case 'AES':
          break;
        default:
          if (callback) callback(new Error(`Invocation error: auth is WPA(2)PSK but unsupported encryption ${encryption} provided.`));
          return;
      }
    }
    if (encryption === 'NONE' && passphrase !== null) {
      if (callback) callback(new Error('Invocation error: encryption is NONE but passphrase is not null.'));
      return;
    } else if (encryption === 'WEP-H') {
      // TODO support WEP-H by validating/constructing passphrase correctly
      if (callback) callback(new Error('Invocation error: WEP-H is not yet supported by this library.'));
      return;
    } else if (encryption === 'WEP-A') {
      if (passphrase && passphrase.length !== 5 && passphrase.length !== 13) {
        if (callback) callback(new Error(`Invocation error: encryption is WEP-A but passphrase length is ${passphrase.length} characters and must be either 5 or 13 characters.`));
        return;
      }
    } else if (encryption === 'TKIP' || encryption === 'AES') {
      if (passphrase && (passphrase.length < 8 || passphrase.length > 63)) {
        if (callback) callback(new Error(`Invocation error: encryption is ${encryption} but passphrase length is ${passphrase.length} characters and must be 8-63 inclusive.`));
        return;
      }
    }
    let cmd;
    if (encryption === 'NONE') {
      cmd = _assembleCommand('wifiClientAuth', 'OPEN', 'NONE');
    } else {
      cmd = _assembleCommand('wifiClientAuth', auth, encryption, passphrase || '');
    }
    this._runCommandNoResponse(cmd, callback);
  }
}
