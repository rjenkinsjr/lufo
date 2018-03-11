// @flow
const { Map } = require('immutable');
const UdpStrings = require('./UdpStrings');

/**
 * This {@link https://facebook.github.io/immutable-js/docs/#/Map Map} contains
 * all UFO UDP commands.
 */
const UdpCommands = {
  /*
   * Common commands
   */
  hello: {
    // getter-only
    // arg 1 is IP address
    // arg 2 is MAC address
    // arg 3 is model number
    cmd: UdpStrings.get('defaultHello'),
    literal: true,
    get: []
  },
  helloAck: {
    // getter-only
    cmd: UdpStrings.get('ack'),
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
  },

  /*
   * Wifi AP commands
   */
  wifiApIp: {
    // arg 1 is IP address
    // arg 2 is netmask
    cmd: 'LANN',
    get: []
  },
  wifiApBroadcast: {
    // arg 1 is "11B", "11BG" or "11BGN"
    // arg 2 is SSID, 32 characters or less
    // arg 3 is "CH1" thru "CH11"
    cmd: 'WAP',
    get: []
  },
  wifiApAuth: {
    // arg 1 (auth) is "OPEN" or "WPA2PSK"
    // arg 2 (encryption) is "NONE" or "AES"
    // arg 3 (passphrase) is an ASCII string between 8 and 63 characters, inclusive
    cmd: 'WAKEY',
    get: []
  },
  wifiApLed: {
    // arg 1 is "on" or "off"
    cmd: 'WALKIND',
    get: []
  },
  wifiApDhcp: {
    // arg 1 is "on" or "off"
    // arg 2 is start octet
    // arg 3 is end octet
    cmd: 'WADHCP',
    get: []
  },

  /*
   * WiFi client commands
   */
  wifiClientApInfo: {
    // getter-only
    // arg 1 is the literal string "Disconnected" or the variable string "SSID(MAC)"
    cmd: 'WSLK',
    get: []
  },
  wifiClientApSignal: {
    // getter-only
    // arg 1 is the literal string "Disconnected" or an arbitrary string
    cmd: 'WSLQ',
    get: []
  },
  wifiClientIp: {
    // arg 1 is "static" or "DHCP"
    // arg 2 is IP address
    // arg 3 is netmask
    // arg 4 is gateway
    cmd: 'WANN',
    get: []
  },
  wifiClientSsid: {
    // arg 1 is SSID, 32 characters or less
    cmd: 'WSSSID',
    get: []
  },
  wifiClientAuth: {
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
    get: []
  }
};

const exportMap: Map<string, Object> = Map(UdpCommands);
module.exports = exportMap;
