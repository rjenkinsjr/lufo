// @flow
import * as dgram from 'dgram';
import _ from 'lodash';
import UdpCommands from './UdpCommands';
import UdpStrings from './UdpStrings';
import * as UdpTypes from './UdpTypes';

/* Private variables */
const defaultPort = 48899;
const normalizeMac = function (mac: string): string { return mac.toLowerCase().replace(/[-:]/g, '').replace(/(.{2})/g, '$1:').slice(0, -1); };
const helloResponseParser = function (response: UdpTypes.UfoHelloResponse): UdpTypes.DiscoveredUfo {
  let splitResponse = response;
  if (!Array.isArray(splitResponse)) splitResponse = splitResponse.split(',');
  return {
    ip: splitResponse[0],
    mac: normalizeMac(splitResponse[1]),
    model: splitResponse[2],
  };
};
const udpCommandRecv = function (response: string): Array<string> {
  let result = response;
  // Chop response prefix/suffix, if they exist.
  const recvPrefix = UdpStrings.recvPrefix();
  const recvSuffix = UdpStrings.recvSuffix();
  if (result.startsWith(recvPrefix)) result = result.substring(recvPrefix.length);
  if (result.startsWith('=')) result = result.substring(1);
  if (result.endsWith(recvSuffix)) result = result.substring(0, result.length - recvPrefix.length);
  result = result.trim();
  if (result === '') {
    return [];
  } else if (Array.isArray(this)) {
    return result.split(',');
  } else if (_.isString(this)) {
    return [result];
  }
  return [];
};
const discoverTimeout = 3000; // milliseconds

/** Static methods for generic UFO UDP functionality. */
export default class {
  /** Returns the default UDP port, 48899. */
  static getDefaultPort(): number { return defaultPort; }
  /**
   * Normalizes a MAC address string by lowercasing all letters and converting
   * separators to colons.
   */
  static macAddress(mac: string): string { return normalizeMac(mac); }
  /**
   * Given a command and optional setter arguments, returns the send and receive
   * logic for the command.
   *
   * The "send" string is the complete AT command string that needs to be sent
   * to the UFO via the UDP client. It includes all the given setter arguments.
   * If no setter arguments are passed, the "send" string constitutes a getter
   * command instead of a setter command.
   *
   * The "recv" function takes the AT command response and returns a possibly
   * empty string array with the parsed response. The prefix and suffix strings
   * are stripped from the response, and the response is split into an array if
   * it contains multiple values. Getter commands will always return an empty
   * array.
   */
  static assembleCommand(name: string, ...setArgs: Array<string>): UdpTypes.UdpCommandSchema {
    // Define the command object.
    const command = UdpCommands.get(name);
    let cmdString = command.cmd;
    const mode = setArgs.length > 0 ? 'set' : 'get';
    // Commands flagged at literal have no syntax translation whatsoever.
    if (!command.literal) {
      // Non-literal commands are wrapped in the send prefix/suffix.
      cmdString = UdpStrings.sendPrefix() + cmdString;
      // Set commands have their argument list prior to the send suffix.
      if (mode === 'set') {
        cmdString += `=${setArgs.join(',')}`;
      }
      cmdString += UdpStrings.sendSuffix();
    }
    // Return the send and receive schema.
    const recvThis = mode === 'get' ? command.get : false;
    const commandSchema = {
      send: cmdString,
      recv: udpCommandRecv.bind(recvThis),
    };
    Object.freeze(commandSchema);
    return commandSchema;
  }
  /**
   * Converts a "hello" command response to an object containing the IP, MAC and
   * model of the UFO.
   */
  static parseHelloResponse(response: UdpTypes.UfoHelloResponse): UdpTypes.DiscoveredUfo { return helloResponseParser(response); }
  /**
   * Searches for UFOs on the network and invokes the given callback with the
   * resulting list.
   */
  static discover(options: UdpTypes.UfoDiscoverOptions, callback: UdpTypes.UdpDiscoverCallback): void {
    // Return variables.
    let error = null;
    const data = [];
    // Set the default password if none was given.
    const hello = Buffer.from(options.password ? options.password : UdpStrings.defaultHello());
    // Set the default timeout if none was given.
    let timeout = options.timeout || -1;
    if (!timeout || timeout < 0) timeout = discoverTimeout;
    // Set the default remote port if none was given.
    let remotePort = options.remotePort || -1;
    if (!remotePort || remotePort < 0) remotePort = defaultPort;
    // Setup the socket. Let Node exit if this socket is still active.
    let stopDiscover: ?TimeoutID = null;
    const socket: dgram$Socket = dgram.createSocket('udp4');
    socket.unref();
    // Define the listener's event handlers.
    socket.on('close', () => {
      if (stopDiscover) clearTimeout(stopDiscover);
      typeof callback === 'function' && callback(error, data);
    });
    socket.on('error', (err) => {
      if (stopDiscover) clearTimeout(stopDiscover);
      error = err;
      socket.close();
    });
    socket.on('message', (msg, rinfo) => {
      if (!error) {
        const message = msg.toString('utf8');
        // The socket sends itself the request message. Ignore this.
        if (message !== hello) {
          // Add the result to our array.
          data.push(helloResponseParser(message));
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
    const localPort = options.localPort;
    if (!localPort || localPort < 0) {
      socket.bind();
    } else {
      socket.bind(localPort);
    }
  }
}
