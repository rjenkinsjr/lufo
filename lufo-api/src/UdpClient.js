// @flow
import * as util from 'util';
import * as dgram from 'dgram';
import * as net from 'net';
import _ from 'lodash';
import Ufo from './Ufo';
import type { UfoOptions } from './UfoOptions';

/**
 * Details of a UFO found by {@link Ufo.discover}.
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
 * {@link Ufo.discover} options.
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
 * A WiFi network discovered by the {@link Ufo#doWifiScan} method.
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

/**
 * Provides an API to UFOs for interacting with the UFO's UDP server.
 * @private
 */
export class UdpClient {
  _ufo: Ufo;
  _options: UdpOptions;
  _dead: boolean;
  _disconnectCallback: ?Function;
  _socket: dgram$Socket;
  _error: ?Error;
  _receiveCallback: ?Function;
  _receiveParser: ?UdpCommandReceiveParser;
  constructor(ufo: Ufo, options: UfoOptions) {
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
    // This property contains the reject callback for the currently active
    // Promise. If an error occurs, this callback is passed up to the enclosing
    // UFO object so it can eventually be invoked after the UFO object is fully
    // disconnected.
    this._disconnectCallback = null;
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
    // The socket has been closed; react appropriately.
    this._socket.on('close', () => {
      this._socket.unref();
      this._ufo.emit('udpDead', {
        error: this._error,
        callback: this._disconnectCallback,
      });
    });
  }
  /** Searches for UFOs on the network. Returned array may be empty. */
  static discover(options: UfoDiscoverOptions): Promise<Array<DiscoveredUfo>> {
    // Set the default password if none was given.
    const hello = Buffer.from(options.password ? options.password : defaultHello);
    // Set the default timeout if none was given.
    let timeout = options.timeout || -1;
    if (timeout < 0) timeout = discoverTimeout;
    // Set the default remote port if none was given.
    let remotePort = options.remotePort || -1;
    if (remotePort < 0) remotePort = defaultPort;
    // Begin async.
    return new Promise((resolve, reject) => {
      // Return variables.
      let error = null;
      const data = [];
      // Setup the socket. Let Node exit if this socket is still active.
      let stopDiscover: ?TimeoutID = null;
      const socket: dgram$Socket = dgram.createSocket('udp4');
      socket.unref();
      // Define the listener's event handlers.
      socket.on('close', () => {
        if (stopDiscover) clearTimeout(stopDiscover);
        if (error) reject(error); else resolve(data);
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
    });
  }
  /*
   * Private methods
   */
  /*
   * For methods annotated as @internalUdp, the following comments apply:
   *
   * If this promise is resolved, it should be handled normally so as to allow
   * the result to bubble up to the calling code.
   *
   * If this promise is rejected, however, it is rejected with no arguments and
   * an error will be emitted on the UDP socket; this will disconnect the UFO
   * object and eventually invoke the calling code's promise reject function. As
   * such, rejections from this promise should under normal circumstances not
   * be handled by calling code.
   */
  /**
   * Sends the given command to the UFO. This method is suitable for commands
   * that do not send responses.
   * @private
   * @internalUdp
   */
  _send(cmd: UdpCommandSchema, reqReject: Function): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(); return; }
      this._disconnectCallback = reqReject;
      this._socket.send(Buffer.from(cmd.send), defaultPort, this._options.host, (err) => {
        // Implement proper error handling according to API docs.
        if (err) {
          this._socket.emit('error', err);
          reject();
        } else {
          this._disconnectCallback = null;
          resolve();
        }
      });
    });
  }
  /**
   * Sends the given command to the UFO. The promise resolves once any amount
   * of data is received from the UFO.
   * @private
   * @internalUdp
   */
  _sendAndWait(cmd: UdpCommandSchema, reqReject: Function): Promise<null | string | Array<string>> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(null); return; }
      this._disconnectCallback = reqReject;
      // This callback only handles logic errors (e.g. we got a UDP response
      // but it contains an error code). We treat these errors the same way as
      // UDP socket errors.
      this._receiveCallback = (err, data) => {
        this._disconnectCallback = null;
        if (err) {
          reqReject(err);
          reject();
        } else {
          resolve(data);
        }
      };
      this._receiveParser = cmd.recv;
      // This callback only handles UDP socket errors (e.g. network failures).
      this._socket.send(Buffer.from(cmd.send), defaultPort, this._options.host, (err) => {
        if (err) {
          this._socket.emit('error', err);
          reject();
        }
      });
    });
  }
  /**
   * Sends the given command to the UFO and indefnitely streams response data
   * back to the provided callback. The calling code is responsible for any
   * required logic/error handling with the data/error received. If this UFO
   * object is dead, the callback is immediately called with two null arguments
   * and no command is sent to the UFO.
   * @private
   */
  _sendAndStream(cmd: UdpCommandSchema, callback: (Error | null, (string | Array<string> | null)) => void): void {
    if (this._dead) {
      callback(null, null);
      return;
    }
    this._receiveCallback = callback;
    this._receiveParser = cmd.recv;
    this._socket.send(Buffer.from(cmd.send), defaultPort, this._options.host, (err) => {
      if (err) callback(err, null);
    });
  }
  /**
   * Puts the UFO in command mode.
   * @private
   * @internalUdp
   */
  _commandMode(reqReject: Function): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(); return; }
      // Say hello.
      const cmd = _assembleCommand('hello');
      if (this._options.password) cmd.send = this._options.password;
      this._sendAndWait(cmd, reqReject).then((msg) => {
        // Give up if the response did not come from the expected IP.
        // 0.0.0.0 occurs when connected to a UFO in AP mode.
        const ufo = _parseHelloResponse(msg || '');
        if (ufo.ip === this._options.host || ufo.ip === '0.0.0.0') {
          // Switch to command mode, or give up if we can't.
          this._send(_assembleCommand('helloAck'), reqReject).then(resolve);
        } else {
          this._disconnectCallback = reqReject;
          this._socket.emit('error', new Error(`Received hello response from unexpected host: ${JSON.stringify(ufo)}`));
          reject(); // Chain rejection for completeness.
        }
      });
    });
  }
  /**
   * Sends the "AT+Q\r" message, ending command transmission and preparing for
   * future commands to be sent.
   * @private
   * @internalUdp
   */
  _endCommand(reqReject: Function): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(); return; }
      this._send(_assembleCommand('endCmd'), reqReject)
        .then(resolve).catch(reject); // Chain rejection for completeness.
    });
  }
  /**
   * Puts the UFO in command mode and sends the given command to the UFO. If
   * successful, the promise resolves with the response.
   * @private
   * @internalUdp
   */
  _runCommand(cmd: UdpCommandSchema, reqReject: Function): Promise<null | string | Array<string>> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(null); return; }
      this._commandMode(reqReject).then(() => {
        this._sendAndWait(cmd, reqReject)
          .then(resolve).catch(reject); // Chain rejection for completeness.
      }).catch(reject); // Chain rejection for completeness.
    });
  }
  /**
   * Puts the UFO in command mode and sends the given command to the UFO. If
   * successful, the promise resolves with the response. The "end" command is
   * sent to the UFO before the promise is resolved.
   * @private
   * @internalUdp
   */
  _runCommandWithResponse(cmd: UdpCommandSchema, reqReject: Function): Promise<null | string | Array<string>> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(null); return; }
      this._runCommand(cmd, reqReject).then((result) => {
        this._endCommand(reqReject)
          .then(() => resolve(result))
          .catch(reject); // Chain rejection for completeness.
      }).catch(reject); // Chain rejection for completeness.
    });
  }
  /**
   * Puts the UFO in command mode and sends the given command to the UFO. If
   * successful, the promise resolves with no arguments.
   * @private
   * @internalUdp
   */
  _runCommandNoResponse(cmd: UdpCommandSchema, reqReject: Function): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(); return; }
      this._runCommandWithResponse(cmd, reqReject)
        .then(() => resolve()).catch(reject); // Chain rejection for completeness.
    });
  }
  /*
   * Core methods
   */
  /** Binds the UDP socket on this machine. */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(); return; }
      let port = 0;
      if (this._options.localPort > 0) port = this._options.localPort;
      try {
        // Intercept/reject any emitted errors when we attempt to bind.
        this._socket.on('error', reject);
        this._socket.bind(port, this._options.localAddress, () => {
          // Remove the intercept listener since we bound successfully.
          this._socket.removeListener('error', reject);
          // Now we can define our true error handler.
          //
          // Capture socket errors so we can respond appropriately.
          // These are not AT command errors; we handle those separately.
          this._socket.on('error', (err) => {
            this._dead = true;
            this._error = err;
            this._socket.close();
          });
          resolve();
        });
      } catch (e) {
        // APIs say that bind() can throw an Error, so we need to capture that too.
        reject(e);
      }
    });
  }
  /** Closes the UDP socket on this machine. */
  disconnect(): void {
    if (this._dead) return;
    // We're intentionally closing this connection.
    // Don't allow it to be used again.
    this._dead = true;
    this._socket.close();
  }
  /** Returns the UFO's hardware/firmware version. */
  getVersion(): Promise<null | string> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(null); return; }
      this._runCommandWithResponse(_assembleCommand('moduleVersion'), reject)
        .then(version => resolve(String(version)));
    });
  }
  /**
   * Reboots the UFO. The owning UFO object will be disconnected after this
   * method is invoked.
   */
  reboot(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(); return; }
      // Reboot and disconnect.
      // We cannot use _runCommand here because we wiill not receive any response.
      this._commandMode(reject).then(() => {
        this._send(_assembleCommand('reboot'), reject).then(() => {
          this._ufo.disconnect().then(resolve);
        });
      });
    });
  }
  /**
   * Resets the UFO to factory defaults. The owning UFO object will be
   * disconnected after this method is invoked.
   */
  factoryReset(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(); return; }
      // Request a factory reset.
      // This command implies a reboot, so no explicit reboot command is needed.
      let expected = commandMap.get('factoryReset');
      if (expected) expected = expected.get;
      this._runCommand(_assembleCommand('factoryReset'), reject).then((resp) => {
        // Emit an error if the response did not match, or otherwise disconnect.
        if (resp === expected) {
          this._ufo.disconnect().then(resolve);
        } else {
          this._disconnectCallback = reject;
          const response = String(resp) || 'null';
          this._socket.emit('error', new Error(`Unexpected response: ${response}`));
        }
      });
    });
  }
  /** Returns the NTP server IP address. */
  getNtpServer(): Promise<null | string> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(null); return; }
      this._runCommandWithResponse(_assembleCommand('ntp'), reject)
        .then(ipAddress => resolve(String(ipAddress)));
    });
  }
  /** Sets the NTP server IP address. */
  setNtpServer(ipAddress: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(); return; }
      if (!net.isIPv4(ipAddress)) {
        reject(new Error(`Invalid IP address provided: ${ipAddress}.`));
        return;
      }
      this._runCommandNoResponse(_assembleCommand('ntp', ipAddress), reject)
        .then(resolve);
    });
  }
  /** Sets the UDP password. */
  setUdpPassword(password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(); return; }
      if (password.length > 20) {
        reject(new Error(`Password is ${password.length} characters long, exceeding limit of 20.`));
        return;
      }
      this._runCommandNoResponse(_assembleCommand('udpPassword', password), reject).then(() => {
        // Update the password in the options object so we can continue
        // using this client to communicate.
        this._options.password = password;
        resolve();
      });
    });
  }
  /**
   * Sets the TCP port. The owning UFO object will be disconnected after this
   * method is invoked.
   */
  setTcpPort(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(); return; }
      this._runCommandWithResponse(_assembleCommand('tcpServer'), reject).then((tcpServer) => {
        const cleanPort = _.clamp(port, 0, 65535);
        if (tcpServer) {
          this._runCommandNoResponse(_assembleCommand('tcpServer', tcpServer[0], tcpServer[1], cleanPort, tcpServer[3]), reject).then(() => {
            this._ufo.disconnect().then(resolve);
          });
        } else {
          reject(new Error('Returned TCP server information is null.'));
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
  getWifiAutoSwitch(): Promise<null | string> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(null); return; }
      this._runCommandWithResponse(_assembleCommand('wifiAutoSwitch'), reject)
        .then(value => resolve(String(value)));
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
  setWifiAutoSwitch(value: 'off' | 'on' | 'auto' | number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(); return; }
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
        reject(new Error(`Invalid value ${value}, must be "off", "on", "auto" or 3-120 inclusive.`));
        return;
      }
      this._runCommandNoResponse(_assembleCommand('wifiAutoSwitch', value.toString()), reject).then(resolve);
    });
  }
  /**
   * Returns the WiFi mode:
   * - "AP" (AP mode)
   * - "STA" (client mode)
   * - "APSTA" (client and AP mode)
   */
  getWifiMode(): Promise<null | string> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(null); return; }
      this._runCommandWithResponse(_assembleCommand('wifiMode'), reject)
        .then(mode => resolve(String(mode)));
    });
  }
  /**
   * Sets the WiFi mode:
   * - "AP" (AP mode)
   * - "STA" (client mode)
   * - "APSTA" (client and AP mode)
   */
  setWifiMode(mode: 'AP' | 'STA' | 'APSTA'): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(); return; }
      switch (mode) {
        case 'AP':
        case 'STA':
        case 'APSTA':
          break;
        default:
          reject(new Error(`Invalid mode ${mode}, must be "AP", "STA" or "APSTA".`));
          return;
      }
      this._runCommandNoResponse(_assembleCommand('wifiMode', mode), reject).then(resolve);
    });
  }
  /** Performs a WiFi AP scan from the UFO and returns the results. */
  doWifiScan(): Promise<null | Array<WifiNetwork>> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(null); return; }
      const resultArray = [];
      let headerReceived = false;
      let errorReceived = false;
      this._commandMode(reject).then(() => {
        this._sendAndStream(_assembleCommand('wifiScan'), (err, result) => {
          if (!errorReceived) {
            if (err) {
              errorReceived = true;
              this._endCommand(reject).then(() => {
                this._disconnectCallback = reject;
                this._socket.emit('error', err);
              });
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
              this._endCommand(reject).then(() => resolve(resultArray));
            }
          }
        });
      }).catch(reject);
    });
  }
  /*
   * AP WiFi methods
   */
  /** Returns the IP address and netmask of the UFO AP. */
  getWifiApIp(): Promise<null | {ip: string, mask: string}> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(null); return; }
      this._runCommandWithResponse(_assembleCommand('wifiApIp'), reject).then((result) => {
        const resultArray = _asArray(result || '');
        resolve({
          ip: resultArray[0],
          mask: resultArray[1],
        });
      });
    });
  }
  /** Sets the IP address and netmask of the UFO AP. */
  setWifiApIp(ip: string, mask: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(); return; }
      if (!net.isIPv4(ip)) {
        reject(new Error(`Invalid IP address provided: ${ip}.`));
        return;
      }
      if (!net.isIPv4(mask)) {
        reject(new Error(`Invalid subnet mask provided: ${mask}.`));
        return;
      }
      this._runCommandNoResponse(_assembleCommand('wifiApIp', ip, mask), reject).then(resolve);
    });
  }
  /** Returns the UFO AP's broadcast information. Channel is 1-11 inclusive. */
  getWifiApBroadcast(): Promise<null | {mode: 'b' | 'bg' | 'bgn', ssid: string, channel: number}> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(null); return; }
      this._runCommandWithResponse(_assembleCommand('wifiApBroadcast'), reject).then((result) => {
        const resultArray = _asArray(result || '');
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
            this._disconnectCallback = reject;
            this._socket.emit('error', new Error(`Impossible AP mode: ${rawMode}`));
            return;
        }
        const ssid = resultArray[1];
        const channel = parseInt(resultArray[2].substring(2), 10);
        resolve({ mode, ssid, channel });
      });
    });
  }
  /** Sets the UFO AP's broadcast information. Channel is 1-11 inclusive. */
  setWifiApBroadcast(mode: 'b' | 'bg' | 'bgn', ssid: string, channel: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(); return; }
      if (ssid.length > 32) {
        reject(new Error(`SSID is ${ssid.length} characters long, exceeding limit of 32.`));
        return;
      }
      const cleanChannel = _.clamp(channel, 1, 11);
      this._runCommandNoResponse(_assembleCommand('wifiApBroadcast', `11${mode.toUpperCase()}`, ssid, `CH${cleanChannel}`), reject).then(resolve);
    });
  }
  /** Returns the UFO AP's passphrase. If null, AP network is open. */
  getWifiApPassphrase(): Promise<null | string> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(null); return; }
      this._runCommandWithResponse(_assembleCommand('wifiApAuth'), reject).then((result) => {
        const resultArray = _asArray(result || '');
        resolve(resultArray[0] === 'OPEN' ? null : resultArray[2]);
      });
    });
  }
  /** Sets the UFO's AP passphrase. If null, network will be open. */
  setWifiApPassphrase(passphrase: string | null): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(); return; }
      let cmd;
      if (passphrase === null) {
        cmd = _assembleCommand('wifiApAuth', 'OPEN', 'NONE');
      } else if (passphrase.length < 8 || passphrase.length > 63) {
        reject(new Error(`Passphrase is ${passphrase.length} characters long, must be 8-63 characters inclusive.`));
        return;
      } else {
        cmd = _assembleCommand('wifiApAuth', 'WPA2PSK', 'AES', passphrase);
      }
      this._runCommandNoResponse(cmd, reject).then(resolve);
    });
  }
  /**
   * Returns the UFO AP's connection LED flag. If on, the UFO's blue LED will
   * turn on when any client is connected to the AP.
   */
  getWifiApLed(): Promise<null | boolean> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(null); return; }
      this._runCommandWithResponse(_assembleCommand('wifiApLed'), reject).then((result) => {
        resolve(String(result) === 'on');
      });
    });
  }
  /**
   * Sets the UFO AP's connection LED flag. If on, the UFO's blue LED will turn
   * on when any client is connected to the AP.
   */
  setWifiApLed(on: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(); return; }
      this._runCommandNoResponse(_assembleCommand('wifiApLed', on ? 'on' : 'off'), reject).then(resolve);
    });
  }
  /**
   * Returns the UFO AP's DHCP server settings. If DHCP is on, the returned
   * object's "start" and "end" properties will be 0-254 inclusive.
   */
  getWifiApDhcp(): Promise<null | {on: boolean, start?: number, end?: number}> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(null); return; }
      this._runCommandWithResponse(_assembleCommand('wifiApDhcp'), reject).then((result) => {
        const resultArray = _asArray(result || '');
        const dhcp = {};
        dhcp.on = resultArray[0] === 'on';
        if (dhcp.on) {
          dhcp.start = parseInt(resultArray[1], 10);
          dhcp.end = parseInt(resultArray[2], 10);
        }
        resolve(dhcp);
      });
    });
  }
  /**
   * Sets the UFO AP's DHCP address range. Both arguments are 0-254 inclusive.
   * This command implicitly enables the DHCP server.
   */
  setWifiApDhcp(start: number, end: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(); return; }
      const cleanStart = _.clamp(start, 0, 254);
      const cleanEnd = _.clamp(end, 0, 254);
      this._runCommandNoResponse(_assembleCommand('wifiApDhcp', 'on', cleanStart, cleanEnd), reject).then(resolve);
    });
  }
  /** Disables the UFO AP's DHCP server. */
  disableWifiApDhcp(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(); return; }
      this._runCommandNoResponse(_assembleCommand('wifiApDhcp', 'off'), reject).then(resolve);
    });
  }
  /*
   * Client WiFi methods
   */
  /**
   * Returns the UFO client's AP SSID and MAC address. If the UFO is not
   * connected to any AP, the returned object will be null.
   */
  getWifiClientApInfo(): Promise<null | {ssid: string, mac: string}> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(null); return; }
      this._runCommandWithResponse(_assembleCommand('wifiClientApInfo'), reject).then((result) => {
        const realResult = String(result);
        if (realResult === 'Disconnected') {
          resolve(null);
        } else {
          const match = realResult.match(/(.{1,32})\(([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})\)/i) || [];
          if (match.length < 2) resolve(null);
          else resolve({ ssid: match[1], mac: _macAddress(match[2]) });
        }
      });
    });
  }
  /** Returns the UFO client's AP signal strength, as seen by the UFO. */
  getWifiClientApSignal(): Promise<null | string> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(null); return; }
      this._runCommandWithResponse(_assembleCommand('wifiClientApSignal'), reject).then((result) => {
        const resultArray = _asArray(result || '');
        resolve(resultArray.join(','));
      });
    });
  }
  /** Returns the UFO client's IP configuration. */
  getWifiClientIp(): Promise<null | {dhcp: boolean, ip: string, mask: string, gateway: string}> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(null); return; }
      this._runCommandWithResponse(_assembleCommand('wifiClientIp'), reject).then((result) => {
        const resultArray = _asArray(result || '');
        resolve({
          dhcp: resultArray[0] === 'DHCP',
          ip: resultArray[1],
          mask: resultArray[2],
          gateway: resultArray[3],
        });
      });
    });
  }
  /** Enables DHCP mode for the UFO client. */
  setWifiClientIpDhcp(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(); return; }
      this._runCommandNoResponse(_assembleCommand('wifiClientIp', 'DHCP'), reject).then(resolve);
    });
  }
  /** Sets the IP configuration for the UFO client. Implicitly disables DHCP. */
  setWifiClientIpStatic(ip: string, mask: string, gateway: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(); return; }
      if (!net.isIPv4(ip)) {
        reject(new Error(`Invalid IP address provided: ${ip}.`));
        return;
      }
      if (!net.isIPv4(mask)) {
        reject(new Error(`Invalid subnet mask provided: ${mask}.`));
        return;
      }
      if (!net.isIPv4(gateway)) {
        reject(new Error(`Invalid gateway provided: ${gateway}.`));
        return;
      }
      this._runCommandNoResponse(_assembleCommand('wifiClientIp', 'static', ip, mask, gateway), reject).then(resolve);
    });
  }
  /** Returns the UFO client's AP SSID. */
  getWifiClientSsid(): Promise<null | string> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(null); return; }
      this._runCommandWithResponse(_assembleCommand('wifiClientSsid'), reject).then((result) => {
        resolve(String(result));
      });
    });
  }
  /** Sets the UFO client's AP SSID. */
  setWifiClientSsid(ssid: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(); return; }
      if (ssid.length > 32) {
        reject(new Error(`SSID is ${ssid.length} characters long, exceeding limit of 32.`));
        return;
      }
      this._runCommandNoResponse(_assembleCommand('wifiClientSsid', ssid), reject).then(resolve);
    });
  }
  /**
   * Returns the UFO client's AP auth settings.
   * - If auth is OPEN, encryption is NONE, WEP-H or WEP-A.
   * - If auth is SHARED, encryption is WEP-H or WEP-A.
   * - If auth is WPAPSK or WPA2PSK, encryption is TKIP or AES.
   * - If encryption is NONE, paraphrase is null.
   * - If encryption is WEP-H, paraphrase is exactly 10 or 26 hexadecimal
   * characters in length.
   * - If encryption is WEP-A, paraphrase is exactly 5 or 13 ASCII characters in
   * length.
   * - If encryption is TKIP or AES, paraphrase is 8-63 ASCII characters in
   * length, inclusive.
   */
  getWifiClientAuth(): Promise<null | {auth: string, encryption: string, passphrase: string | null}> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(null); return; }
      this._runCommandWithResponse(_assembleCommand('wifiClientAuth'), reject).then((result) => {
        const resultArray = _asArray(result || '');
        resolve({
          auth: resultArray[0],
          encryption: resultArray[1],
          passphrase: resultArray[2] || null,
        });
      });
    });
  }
  /**
   * Sets the UFO client's AP auth settings.
   * - If auth is OPEN, encryption must be NONE, WEP-H or WEP-A.
   * - If auth is SHARED, encryption must be WEP-H or WEP-A.
   * - If auth is WPAPSK or WPA2PSK, encryption must be TKIP or AES.
   * - If encryption is NONE, paraphrase must be null.
   * - If encryption is WEP-H, paraphrase must be exactly 10 or 26 hexadecimal
   * characters in length.
   * - If encryption is WEP-A, paraphrase must be exactly 5 or 13 ASCII
   * characters in length.
   * - If encryption is TKIP or AES, paraphrase must be 8-63 ASCII characters in
   * length, inclusive.
   */
  setWifiClientAuth(
    auth: 'OPEN' | 'SHARED' | 'WPAPSK' | 'WPA2PSK',
    encryption: 'NONE' | 'WEP-H' | 'WEP-A' | 'TKIP' | 'AES',
    passphrase?: string | null,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._dead) { resolve(); return; }
      if (auth === 'OPEN') {
        switch (encryption) {
          case 'NONE':
          case 'WEP-H':
          case 'WEP-A':
            break;
          default:
            reject(new Error(`Invocation error: auth is OPEN but unsupported encryption ${encryption} provided.`));
            return;
        }
      } else if (auth === 'SHARED') {
        switch (encryption) {
          case 'WEP-H':
          case 'WEP-A':
            break;
          default:
            reject(new Error(`Invocation error: auth is SHARED but unsupported encryption ${encryption} provided.`));
            return;
        }
      } else {
        switch (encryption) {
          case 'TKIP':
          case 'AES':
            break;
          default:
            reject(new Error(`Invocation error: auth is WPA(2)PSK but unsupported encryption ${encryption} provided.`));
            return;
        }
      }
      if (encryption === 'NONE' && passphrase !== null) {
        reject(new Error('Invocation error: encryption is NONE but passphrase was provided.'));
        return;
      } else if (!passphrase) {
        reject(new Error('Invocation error: encryption is enabled but passphrase was not provided.'));
        return;
      } else if (encryption === 'WEP-H') {
        if (passphrase.length !== 10 && passphrase.length !== 26) {
          reject(new Error(`Invocation error: encryption is WEP-H but passphrase length is ${passphrase.length}, not 10 or 26.`));
          return;
        }
        if (passphrase.replace(/[0-9a-fA-F]/g, '').length !== 0) {
          reject(new Error('Invocation error: encryption is WEP-H but passphrase contains non-hexadecimal characters.'));
          return;
        }
      } else if (encryption === 'WEP-A') {
        if (passphrase.length !== 5 && passphrase.length !== 13) {
          reject(new Error(`Invocation error: encryption is WEP-A but passphrase length is ${passphrase.length}, not 5 or 13.`));
          return;
        }
        if (passphrase.replace(/[\x00-\x7F]/g, '').length !== 0) { // eslint-disable-line no-control-regex
          reject(new Error('Invocation error: encryption is WEP-A but passphrase contains non-ASCII characters.'));
          return;
        }
      } else { // TKIP or AES
        if (passphrase.length < 8 || passphrase.length > 63) {
          reject(new Error(`Invocation error: encryption is ${encryption} but passphrase length is ${passphrase.length}, not 8-63 inclusive.`));
          return;
        }
        if (passphrase.replace(/[\x00-\x7F]/g, '').length !== 0) { // eslint-disable-line no-control-regex
          reject(new Error(`Invocation error: encryption is ${encryption} but passphrase contains non-ASCII characters.`));
          return;
        }
      }
      let cmd;
      if (encryption === 'NONE') {
        cmd = _assembleCommand('wifiClientAuth', 'OPEN', 'NONE');
      } else {
        cmd = _assembleCommand('wifiClientAuth', auth, encryption, passphrase || '');
      }
      this._runCommandNoResponse(cmd, reject).then(resolve);
    });
  }
}
export default UdpClient;
