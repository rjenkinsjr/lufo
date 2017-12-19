const Strings = lufoRequire('udp/model/Strings');
module.exports = Object.freeze({
  hello: {
    send: Strings.defaultHello,
    sendLiteral: true,
    // arg 1 is IP address
    // arg 2 is MAC address
    // arg 3 is model number
    recv: []
  },
  // The "hello" command client-side acknowledgement message.
  helloAck: {
    send: Strings.ack,
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
  moduleVersion: {
    send: 'VER',
    // arbitrary string
    recv: []
  },
  ntp: {
    // IP address, default is 61.164.36.105
    get: {
      send: 'NTPSER',
      recv: []
    },
    set: {
      send: 'NTPSER=%s'
    }
  },
  udpPassword: {
    // password must be 20 characters or less
    get: {
      send: 'ASWD',
      recv: []
    },
    set: {
      send: 'ASWD=%s'
    }
  },
  tcpServer: {
    // arg 1 is "TCP" or "UDP"
    // arg 2 is "Client" or "Server"
    // arg 3 is port number
    // arg 4 is IP address
    // TODO IP address probably should not change
    get: {
      send: 'NETP',
      recv: []
    },
    set: {
      send: 'NETP=%s,%s,%s,%s'
    }
  },
  wifiAutoSwitch: {
    // Determines how long the module will wait with no client WiFi connection
    // before it switches to AP mode.
    //
    // "off": disabled; AP mode will never be turned on
    // "on" 1 minute
    // "auto": 10 minutes
    // 3-120: X minutes
    get: {
      send: 'WADHCP',
      recv: []
    },
    set: {
      send: 'WADHCP=%s,%s,%s'
    }
  },
  wifiMode: {
    // one of "AP", "STA" or "APSTA"
    get: {
      send: 'WMODE',
      recv: []
    },
    set: {
      send: 'WMODE=%s'
    }
  }
});
