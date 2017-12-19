module.exports = Object.freeze({
  wifiApIp: {
    // arg 1 is IP address
    // arg 2 is netmask
    get: {
      send: 'LANN',
      recv: []
    },
    set: {
      send: 'LANN=%s,%s'
    }
  },
  wifiApParams: {
    // arg 1 is "11B", "11BG" or "11BGN"
    // arg 2 is SSID
    // arg 3 is "CH1" thru "CH11"
    get: {
      send: 'WAP',
      recv: []
    },
    set: {
      send: 'WAP=%s,%s,%s'
    }
  },
  wifiApAuth: {
    // arg #1 (auth): "OPEN" or "WPA2PSK"
    // arg #2 (encryption): "NONE" or "AES"
    // arg #3 (passphrase): an ASCII string between 8 and 63 characters, inclusive
    get: {
      send: 'WAKEY',
      recv: []
    },
    set: {
      send: 'WAKEY=%s,%s,%s'
    }
  },
  wifiApLed: {
    // "on" or "off"
    get: {
      send: 'WALKIND',
      recv: []
    },
    set: {
      send: 'WALKIND=%s'
    }
  },
  wifiApDhcp: {
    // arg 1 is "on" or "off"
    // arg 2 is start octet
    // arg 3 is end octet
    get: {
      send: 'WADHCP',
      recv: []
    },
    set: {
      send: 'WADHCP=%s,%s,%s'
    }
  }
});
