const util = require('util');
const MiscUtils = lufoRequire('misc/Utils');

// The standard acknowledgement message sent by both parties.
const ack = '+ok';
// This is the prefix of all AT commands.
const sendPrefix = 'AT+';
// This is the suffix of all AT commands.
const sendSuffix = '\r';
// This is the prefix of all AT command responses that are not errors.
const recvPrefix = ack;
// This is the suffic of all AT command responses that are not errors.
const recvSuffix = '\r\n\r\n';
// Definition of all supported AT commands, including their send formats,
// receive formats and number of receive arguments.
const commands = Object.freeze({
  hello: {
    // This is the default UDP password.
    send: 'HF-A11ASSISTHREAD',
    sendLiteral: true,
    recv: []
  },
  // The "hello" command client-side acknowledgement message.
  helloAck: {
    send: ack,
    sendLiteral: true
  },
  // Not documented, nor does it show up in AT+H output, but it seems to
  // ease sending multiple commands in sequence. It appears to be some sort
  // of command terminator.
  endCmd: 'Q',
  reboot: 'Z',
  factoryReset: {
    send: 'RELD',
    recv: 'rebooting...'
  },
  wifiMode: {
    get: {
      send: 'WMODE',
      recv: []
    },
    set: {
      // arg is one of 'AP', 'STA' or 'APSTA'
      send: 'WMODE=%s'
    }
  },
  wifiClientSsid: {
    get: {
      send: 'WSSSID',
      recv: []
    },
    set: {
      // arg is the desired SSID, 32 characters or less
      send: 'WSSSID=%s'
    }
  },
  wifiClientAuth: {
    get: {
      send: 'WSKEY',
      recv: []
    },
    set: {
      // arg #1 (auth): one of 'OPEN', 'SHARED', 'WPAPSK' or 'WPA2PSK'
      // arg #2 (encryption): one of:
      // - 'NONE', only when auth is 'OPEN'
      // - 'WEP-H' (hex), only when auth is 'OPEN' or 'SHARED'
      // - 'WEP-A' (ascii), only when auth is 'OPEN' or 'SHARED'
      // - 'TKIP', only when auth is 'WPAPSK' or 'WPA2PSK'
      // - 'AES', only when auth is 'WPAPSK' or 'WPA2PSK'
      // arg #3 (passphrase):
      // - if encryption is 'WEP-H', must be a hex-as-ASCII string of length 10 or 26
      // - if encryption is 'WEP-A', must be an ASCII string of length 5 or 13
      // - if encryption is 'TKIP' or 'AES', must be an ASCII string between 8 and 63 characters, inclusive
      send: 'WSKEY=%s,%s,%s'
    }
  }
});

// Export all of the above.
module.exports = Object.freeze({
  // All UFOs use this port for UDP.
  port: 48899,
  // This is the default UDP password.
  defaultHello: commands.hello.send,
  // This is the prefix of all AT command responses that are errors.
  errAck: '+ERR',
  // Raw commands list.
  commandsRaw: commands,
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
    if (!cmd.sendLiteral) cmd.send = sendPrefix + cmd.send + sendSuffix;
    return Object.freeze({
      send: MiscUtils.format(cmd.send, sendArgs),
      recv: function(response) {
        var result = response;
        // Chop response prefix/suffix, if they exist.
        if (result.startsWith(recvPrefix)) result = result.substring(recvPrefix.length);
        if (result.startsWith('=')) result = result.substring(1);
        if (result.endsWith(recvSuffix)) result = result.substring(0, result.length - recvPrefix.length);
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
});
