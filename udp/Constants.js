const util = require('util');
const MiscUtils = lufoRequire('misc/Utils');
const Strings = lufoRequire('udp/model/Strings');

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
  // - "send" is always a string. Any send arguments provided to getCmd/setCmd
  // are applied to the "send" command string using util.format(); all of these
  // arguments must be strings.
  // - "recv" is a function that accepts the command's response and returns an
  // array with the args from the response. This array is never null, and will
  // be empty for commands whose responses have no arguments.
  command: function(name, getOrSet, ...sendArgs) {
    // Define the command object.
    var cmd = commands[name];
    if (MiscUtils.isString(cmd)) {
      cmd = {
        send: cmd
      };
    } else if (cmd.hasOwnProperty('get') || cmd.hasOwnProperty('set')) {
      cmd = cmd[getOrSet];
    }
    // Apply the send prefix/suffix if applicable.
    if (!cmd.sendLiteral) cmd.send = Strings.sendPrefix + cmd.send + Strings.sendSuffix;
    return Object.freeze({
      send: MiscUtils.format(cmd.send, sendArgs),
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
        } else if (MiscUtils.isString(this)) {
          return [result];
        } else {
          return [];
        }
      }.bind(cmd.recv)
    });
  }
}, Strings));
