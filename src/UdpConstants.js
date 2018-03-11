// @flow
const util = require('util');
const UdpStrings = require('./UdpStrings');
const _ = require('lodash');

/* Private variables */
const defaultPort = 48899;
const commands = require('./UdpCommands');

/**
 * This class contains methods for controlling a UFO's power flag.
 */
class UdpConstants {
  /**
   * Returns the default UDP port, 48899.
   */
  getDefaultPort(): number { return defaultPort; }
  /**
   * Given a command and optional setter arguments, returns the send and receive
   * logic for the command.
   *
   * The "send" string is the complete AT command string that needs to be sent
   * to the UFO via the UDP client. It includes all the given setter arguments.
   * If no setter arguments are passed, the "send" string constitutes a getter
   * command instead of a setter command.
   *
   * The "recv" function takes the AT command response and returns a possibly-empty
   * string array with the parsed response. The prefix and suffix strings are
   * stripped from the response, and the response is split into an array if it
   * contains multiple values. Getter commands will always return an empty array.
   */
  assembleCommand(name: string, ...setArgs: Array<string>): { send: string, recv: Function } {
    // Define the command object.
    var command = commands.get(name);
    var cmdString = command.cmd;
    var mode = setArgs.length > 0 ? 'set' : 'get';
    // Commands flagged at literal have no syntax translation whatsoever.
    if (!command.literal) {
      // Non-literal commands are wrapped in the send prefix/suffix.
      cmdString = UdpStrings.get('sendPrefix') + cmdString;
      // Set commands have their argument list prior to the send suffix.
      if (mode === 'set') {
        cmdString += '=' + setArgs.join(',');
      }
      cmdString += UdpStrings.get('sendSuffix');
    }
    // Return the send and receive schema.
    return Object.freeze({
      send: cmdString,
      recv: function(response: string): Array<string> {
        var result = response;
        // Chop response prefix/suffix, if they exist.
        const recvPrefix = UdpStrings.get('recvPrefix');
        const recvSuffix = UdpStrings.get('recvSuffix');
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
        } else {
          return [];
        }
      }.bind(command[mode] || false)
    });
  }
}

module.exports = Object.freeze(new UdpConstants());
