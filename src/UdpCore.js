const UdpStrings = require('./UdpStrings');
module.exports = Object.freeze({
  hello: {
    // getter-only
    // arg 1 is IP address
    // arg 2 is MAC address
    // arg 3 is model number
    cmd: UdpStrings.defaultHello,
    literal: true,
    get: []
  },
  helloAck: {
    // getter-only
    cmd: UdpStrings.ack,
    literal: true
  },
  reboot: {
    // getter-only
    cmd: 'Z'
  },
  factoryReset: {
    // getter-only
    cmd: 'RELD',
    get: 'rebooting...'
  },
  moduleVersion: {
    // getter-only
    // arbitrary string
    cmd: 'VER',
    get: []
  },
  ntp: {
    // arg 1 is IP address, default is 61.164.36.105
    cmd: 'NTPSER',
    get: []
  },
  udpPassword: {
    // password must be 20 characters or less
    cmd: 'ASWD',
    get: []
  },
  tcpServer: {
    // arg 1 is "TCP" or "UDP"
    // arg 2 is "Client" or "Server"
    // arg 3 is port number
    // arg 4 is IP address
    cmd: 'NETP',
    get: []
  },
  wifiAutoSwitch: {
    // Determines how long the module will wait with no client WiFi connection
    // before it switches to AP mode. Exactly 1 argument.
    //
    // "off": disabled; AP mode will never be turned on
    // "on" 1 minute
    // "auto": 10 minutes
    // 3-120: X minutes
    cmd: 'MDCH',
    get: []
  },
  wifiMode: {
    // arg 1 is "AP", "STA" or "APSTA"
    cmd: 'WMODE',
    get: []
  },
  wifiScan: {
    // getter-only
    // This command actually returns multiple lines, but no special handling is required for that.
    cmd: 'WSCAN',
    get: []
  },
  // Not documented, nor does it show up in AT+H output, but it seems to
  // ease sending multiple commands in sequence. It appears to be some sort
  // of command terminator.
  endCmd: {
    // getter-only
    cmd: 'Q'
  }
});
