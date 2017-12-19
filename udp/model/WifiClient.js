module.exports = Object.freeze({
  wifiClientApInfo: {
    send: 'WSLK',
    // literal string "Disconnected", otherwise "SSID(MAC)"
    recv: []
  },
  wifiClientApSignal: {
    send: 'WSLQ',
    // literal string "Disconnected", otherwise an arbitrary string
    recv: []
  },
  wifiClientIp: {
    // arg 1 is "static" or "DHCP"
    // arg 2 is IP address
    // arg 3 is netmask
    // arg 4 is gateway
    get: {
      send: 'WANN',
      recv: []
    },
    set: {
      send: 'WANN=%s,%s,%s,%s'
    }
  },
  wifiClientSsid: {
    // SSID must be 32 characters or less
    get: {
      send: 'WSSSID',
      recv: []
    },
    set: {
      send: 'WSSSID=%s'
    }
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
    get: {
      send: 'WSKEY',
      recv: []
    },
    set: {
      send: 'WSKEY=%s,%s,%s'
    }
  }
});
