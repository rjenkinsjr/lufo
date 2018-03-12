// @flow
/**
 * Data types used by various UDP functions.
 * @namespace UdpTypes
 */

/**
 * An object that defines a UDP command.
 * @memberof UdpTypes
 * @typedef {Object} UdpCommand
 * @property {string} cmd the AT command string.
 * @property {boolean} [literal] if defined and true, cmd is the exact AT command string.
 * Otherwise, cmd is the AT command string minus the standard prefix/suffix.
 * @property {string | Array<string>} [get] if defined, this command returns a response; otherwise, it does not.
 * If defined as a string, this command returns that literal string as the response.
 * If defined as an (empty) array, this command returns multiple values separated by commas.
 */
export type UdpCommand = {
  cmd: string,
  literal?: boolean,
  get?: string | Array<string>,
}

/**
 * The response from a "hello" UDP command, used to discover UFOs on the network.
 * @memberof UdpTypes
 */
export type UfoHelloResponse = string | Array<string>;

/**
 * Details of a UFO found by {@link UdpUtils.discover}.
 * @memberof UdpTypes
 * @typedef {Object} DiscoveredUfo
 * @property {string} ip The IP address of the UFO.
 * @property {string} mac The MAC address of the UFO, normalized via {@link UdpUtils.macAddress}.
 * @property {string} model The free-form model number string reported by the UFO.
 */
export type DiscoveredUfo = {
  ip: string,
  mac: string,
  model: string,
};

/**
 * A receive function that makes up half of a {@link UdpCommandSchema}.
 * @memberof UdpTypes
 */
export type UdpCommandRecv = (string) => Array<string>;

/**
 * A command schema, returned by {@link UdpUtils.assembleCommand}.
 * @memberof UdpTypes
 * @typedef {Object} UdpCommandSchema
 * @property {string} send The complete AT command that will be sent to the UFO via the UDP socket.
 * @property {UdpCommandRecv} recv A function that takes the AT command response received from the UFO via the UDP socket and returns a possibly-empty array of response arguments.
 */
export type UdpCommandSchema = {
  send: string,
  recv: UdpCommandRecv,
};

/**
 * {@link UdpUtils.discover} options.
 * @memberof UdpTypes
 * @typedef {Object} UfoDiscoverOptions
 * @property {number} [timeout] How long to wait for UFOs to respond, in milliseconds. Default is 3000.
 * @property {string} [password] The UDP password to use when searching for UFOs. If unspecified, {@link UdpStrings.defaultHello} is used.
 * @property {number} [localPort] The UDP port bound on this machine to perform the UFO search. If unspecified, a random port is used.
 * @property {number} [remotePort] The UDP port to which expected UFOs are bound. If unspecified, {@link UdpUtils.getDefaultPort} is used.
 */
export type UfoDiscoverOptions = {
  timeout: ?number,
  password: ?string,
  localPort: ?number,
  remotePort: ?number,
};

/**
 * A callback function that receives an array of discovered UFOs.
 * @memberof UdpTypes
 * @callback
 * @param {Error} error Possibly-null error object.
 * @param {Array<DiscoveredUfo>} ufos The list of UFOs that were discovered; may be empty.
 */
export type UdpDiscoverCallback = (error: ?Error, ufos: Array<DiscoveredUfo>) => void;
