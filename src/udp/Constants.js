const util = require('util');
const Strings = lufoRequire('udp/model/Strings');
const _ = require('lodash');

// Definition of all supported AT commands, including their send formats,
// receive formats and number of receive arguments.
const commands = Object.freeze(Object.assign({},
  lufoRequire('udp/model/Core'),
  lufoRequire('udp/model/WifiClient'),
  lufoRequire('udp/model/WifiAp')
));

// Export all of the above.
module.exports = Object.freeze(Object.assign({
  // All UFOs use this port for UDP.
  port: 48899,
  // Raw commands list.
  commands: commands,
  // Function that returns command syntaxes. An object with keys "send" and
  // "recv" is returned, both of which are never null.
  // - "send" is always a string; this is the command that will be sent to the
  // UFO's UDP socket. It contains all the set arguments provided to this method.
  // - "recv" is a function that accepts the command's response and returns an
  // array with the args from the response. This array is never null, and will
  // be empty for commands whose responses have no arguments.
  command: function(name, ...setArgs) {
    // Define the command object.
    var command = commands[name];
    var cmdString = command.cmd;
    var mode = setArgs.length > 0 ? 'set' : 'get';
    // Commands flagged at literal have no syntax translation whatsoever.
    if (!command.literal) {
      // Non-literal commands are wrapped in the send prefix/suffix.
      cmdString = Strings.sendPrefix + cmdString;
      // Set commands have their argument list prior to the send suffix.
      if (mode === 'set') {
        cmdString += '=' + setArgs.join(',');
      }
      cmdString += Strings.sendSuffix;
    }
    // Return the send and receive schema.
    return Object.freeze({
      send: cmdString,
      recv: function(response) {
        var result = response;
        // Chop response prefix/suffix, if they exist.
        if (result.startsWith(Strings.recvPrefix)) result = result.substring(Strings.recvPrefix.length);
        if (result.startsWith('=')) result = result.substring(1);
        if (result.endsWith(Strings.recvSuffix)) result = result.substring(0, result.length - Strings.recvPrefix.length);
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
}, Strings));
