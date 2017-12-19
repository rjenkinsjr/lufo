module.exports = Object.freeze({
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
});
