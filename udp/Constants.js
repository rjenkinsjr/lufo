// All messages received in command mode from the UFO have this suffix.
const recvSuffix = '\r\n\r\n';
// The standard acknowledgement message sent by both parties.
const ack = '+ok';
// The acknowledgement message prefix when a message has arguments.
const ackArgs = ack + '=';
// This is the constant response for commands that do not return any data.
const ackNoArgs = ack + recvSuffix;
// A map of commands to their send/receive syntax.
const commandSet = Object.freeze({
  ok: { send: ack },
  // Not documented, nor does it show up in AT+H output, but it seems to
  // ease sending multiple commands in sequence. It appears to be some sort
  // of command terminator.
  endCmd: { send: 'AT+Q\r' },
  reboot: { send: 'AT+Z\r' },
  factoryReset: {
    send: 'AT+RELD\r',
    receive: ackArgs + 'rebooting...' + recvSuffix
  },
  wifiMode: {
    // arg: one of 'AP', 'STA' or 'APSTA'
    send: 'AT+WMODE=%s\r',
    receive: ackNoArgs
  },
  wifiClientSsid: {
    // arg: SSID (32 characters or less)
    send: 'AT+WSSSID=%s\r',
    receive: ackNoArgs
  },
  wifiClientAuth: {
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
    send: 'AT+WSKEY=%s,%s,%s\r',
    receive: ackNoArgs
  }
});
// Export all of the above.
module.exports = Object.freeze({
  // All UFOs use this port for UDP.
  port: 48899,
  // This string is used to discover UFOs and to start talking to a specific UFO.
  hello: 'HF-A11ASSISTHREAD',
  // This is the prefix of error responses.
  errAck: '+ERR',
  commandSet: commandSet
});
