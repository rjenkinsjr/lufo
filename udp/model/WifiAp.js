module.exports = Object.freeze({
  wifiApIp: {
    // arg 1 is IP address
    // arg 2 is netmask
    cmd: 'LANN',
    get: []
  },
  wifiApParams: {
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
  }
});
