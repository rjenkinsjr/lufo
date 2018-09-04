const Util = require('./Util');
const { UdpClient } = require('../lib/UdpClient');
const dgram = require('dgram');

const serverHost = '127.0.0.1';
const defaultPort = 48899;
const defaultHello = 'HF-A11ASSISTHREAD';

describe("UdpClient#constructorNonDefault", function() {
  const options = {
    host: 'localhost',
    password: 'abc123',
    remoteUdpPort: 12345,
    localUdpPort: 54321,
    localHost: 'localhost',
  };
  it("accepts default overrides", function() {
    const client = new UdpClient(null, options);
    expect(client._options.host).toBe(options.host);
    expect(client._options.password).toBe(options.password);
    expect(client._options.remoteUdpPort).toBe(options.remotePort);
    expect(client._options.localUdpPort).toBe(options.localPort);
    expect(client._options.localHost).toBe(options.localAddress);
  });
});

describe("UdpClient", function() {
  var server, listening, recv, remotePort, remoteAddr, cmdMode;
  const ufo = {
    disconnect: function(resolve) {
      resolve();
    }
  }
  const ip = '0.0.0.0';
  const mac = '00:00:00:ff:ff:ff';
  const model = 'Dummy Model';
  const term = '\r\n\r\n';
  const ok = `ok${term}`;
  const version = 'abc123';
  const ntpServer = '1.2.3.4';
  const wifiAutoSwitch = 'off';
  const wifiMode = 'STA';
  const wifiApPassphrase = 'abc123';
  const wifiClientSsid = 'abc123';
  beforeEach(async function() {
    server = dgram.createSocket({type:'udp4'});
    recv = [];
    listening = false;
    remotePort = -1;
    remoteAddr = '';
    cmdMode = false;
    function reply(msg) {
      server.send(`${msg}`, remotePort, remoteAddr);
    }
    server.on('message', function(msg, rinfo) {
      remotePort = rinfo.port;
      remoteAddr = rinfo.address;
      const message = msg.toString();
      // Getters and miscellaneous.
      switch (message) {
        case defaultHello:
          server.send(`${ip},${mac},${model}`, remotePort, remoteAddr);
          break;
        case '+ok':
          // A UFO server sends +ok all the time, but it only receives +ok
          // when entering command mode.
          cmdMode = true;
          break;
        case 'AT+Q\r':
          cmdMode = false;
          break;
        case 'AT+VER\r':
          reply(version + term);
          break;
        case 'AT+Z\r':
          // Reboot, so do nothing.
          cmdMode = false;
          break;
        case 'AT+RELD\r':
          reply('rebooting...' + term);
          break;
        case 'AT+NTPSER\r':
          reply(ntpServer + term);
          break;
        case 'AT+NETP\r':
          reply('TCP,Server,0,0.0.0.0' + term);
          break;
        case 'AT+MDCH\r':
          reply(wifiAutoSwitch + term);
          break;
        case 'AT+WMODE\r':
          reply('STA' + term);
          break;
        case 'AT+WSCAN\r':
          reply('CHANNEL,SSID,MAC,AUTH,SIGNAL\n');
          reply('10,SomeNetwork,00:00:00:ff:ff:ff,WPA,70\n');
          reply(term);
          break;
        case 'AT+LANN\r':
          reply('0.0.0.0,0.0.0.0' + term);
          break;
        case 'AT+WAP\r':
          reply('11BGN,abc123,CH7' + term);
          break;
        case 'AT+WAKEY\r':
          reply('WPA2PSK,AES,' + wifiApPassphrase + term);
          break;
        case 'AT+WALKIND\r':
          reply('on' + term);
          break;
        case 'AT+WADHCP\r':
          reply('on,100,150' + term);
          break;
        case 'AT+WSLK\r':
          reply('abc123(00:00:00:ff:ff:ff)' + term);
          break;
        case 'AT+WSLQ\r':
          reply('Disconnected' + term);
          break;
        case 'AT+WANN\r':
          reply('DHCP,0.0.0.0,0.0.0.0,0.0.0.0' + term);
          break;
        case 'AT+WSSSID\r':
          reply(wifiClientSsid + term);
          break;
        case 'AT+WSKEY\r':
          reply('WPA2PSK,AES,abc123' + term);
          break;
        default:
          // Setters
          switch (true) {
            case /AT\+NTPSER=[^,]+\r/.test(message):
            case /AT\+ASWD=[^,]+\r/.test(message):
            case /AT\+NETP=[^,]+,[^,]+,[^,]+,[^,]+\r/.test(message):
            case /AT\+MDCH=[^,]+\r/.test(message):
            case /AT\+WMODE=[^,]+\r/.test(message):
            case /AT\+LANN=[^,]+,[^,]+\r/.test(message):
            case /AT\+WAP=[^,]+,[^,]+,[^,]+\r/.test(message):
            case /AT\+WAKEY=[^,]+,[^,]+,[^,]+\r/.test(message):
            case /AT\+WALKIND=[^,]+\r/.test(message):
            case /AT\+WADHCP=[^,]+\r/.test(message):
            case /AT\+WADHCP=[^,]+,[^,]+,[^,]+\r/.test(message):
            case /AT\+WANN=[^,]+\r/.test(message):
            case /AT\+WANN=[^,]+,[^,]+,[^,]+,[^,]+\r/.test(message):
            case /AT\+WSSSID=[^,]+\r/.test(message):
            case /AT\+WSKEY=[^,]+,[^,]+,[^,]+\r/.test(message):
              reply(ok);
              break;
            default:
              console.log(`Unknown recv: --- ${JSON.stringify(message)} ---`);
              break;
          }
      }
    });
    server.bind(defaultPort, serverHost, function() { listening = true; });
    while (!listening) await Util.sleep(100);
  });
  afterEach(function() { server.close(); });
  it("#constructor applies correct defaults", function() {
    const client = new UdpClient(ufo, {host:serverHost});
    expect(client._options.password).toBe(defaultHello);
    expect(client._options.remotePort).toBe(defaultPort);
    expect(client._options.localPort).toBe(-1);
    expect(client._options.localAddress).toBe(undefined);
  });
  it("#getVersion works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      let response = await client.getVersion();
      await Util.sleep(100);
      expect(response).toBe(version);
    } catch (error) {
      fail(error);
    }
  });
  it("#getNtpServer works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      let response = await client.getNtpServer();
      await Util.sleep(100);
      expect(response).toBe(ntpServer);
    } catch (error) {
      fail(error);
    }
  });
  it("#setNtpServer works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      await client.setNtpServer('1.2.3.4');
    } catch (error) {
      fail(error);
    }
  });
  it("#setUdpPassword works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    const newPassword = 'blahblahblah';
    try {
      await client.connect();
      await client.setUdpPassword(newPassword);
      await Util.sleep(100);
      expect(client._options.password).toBe(newPassword);
    } catch (error) {
      fail(error);
    }
  });
  it("#setTcpPort works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      await client.setTcpPort('11111');
      await Util.sleep(100);
    } catch (error) {
      fail(error);
    }
  });
  it("#getWifiAutoSwitch works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      let response = await client.getWifiAutoSwitch();
      await Util.sleep(100);
      expect(response).toBe(wifiAutoSwitch);
    } catch (error) {
      fail(error);
    }
  });
  it("#setWifiAutoSwitch works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      await client.setWifiAutoSwitch('off');
    } catch (error) {
      fail(error);
    }
  });
  it("#getWifiMode works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      let response = await client.getWifiMode();
      await Util.sleep(100);
      expect(response).toBe(wifiMode);
    } catch (error) {
      fail(error);
    }
  });
  it("#setWifiMode works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      await client.setWifiMode('STA');
    } catch (error) {
      fail(error);
    }
  });
  it("#doWifiScan works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      let response = await client.doWifiScan();
      await Util.sleep(100);
      expect(response).toBeDefined();
      expect(response).not.toBe(null);
      const network = response[0];
      expect(network).not.toBe(null);
      expect(network.channel).not.toBe(null);
      expect(network.ssid).not.toBe(null);
      expect(network.mac).not.toBe(null);
      expect(network.security).not.toBe(null);
      expect(network.strength).not.toBe(null);
    } catch (error) {
      fail(error);
    }
  });
  it("#getWifiApIp works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      let response = await client.getWifiApIp();
      await Util.sleep(100);
      expect(response).toBeDefined();
      expect(response).not.toBe(null);
      expect(response.ip).not.toBe(null);
      expect(response.mask).not.toBe(null);
    } catch (error) {
      fail(error);
    }
  });
  it("#setWifiApIp works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      await client.setWifiApIp('0.0.0.0', '0.0.0.0');
    } catch (error) {
      fail(error);
    }
  });
  it("#getWifiApBroadcast works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      let response = await client.getWifiApBroadcast();
      await Util.sleep(100);
      expect(response).toBeDefined();
      expect(response).not.toBe(null);
      expect(response.mode).not.toBe(null);
      expect(response.ssid).not.toBe(null);
      expect(response.channel).not.toBe(null);
    } catch (error) {
      fail(error);
    }
  });
  it("#setWifiApBroadcast works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      await client.setWifiApBroadcast('bgn', '0.0.0.0', '7');
    } catch (error) {
      fail(error);
    }
  });
  it("#getWifiApPassphrase works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      let response = await client.getWifiApPassphrase();
      await Util.sleep(100);
      expect(response).toBe(wifiApPassphrase);
    } catch (error) {
      fail(error);
    }
  });
  it("#setWifiApPassphrase works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      await client.setWifiApPassphrase('abcd1234');
    } catch (error) {
      fail(error);
    }
  });
  it("#getWifiApLed works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      let response = await client.getWifiApLed();
      await Util.sleep(100);
      expect(response).toBe(true);
    } catch (error) {
      fail(error);
    }
  });
  it("#setWifiApLed works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      await client.setWifiApLed(true);
    } catch (error) {
      fail(error);
    }
  });
  it("#getWifiApDhcp works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      let response = await client.getWifiApDhcp();
      await Util.sleep(100);
      expect(response).toBeDefined();
      expect(response).not.toBe(null);
      expect(response.on).not.toBe(null);
      expect(response.start).not.toBe(null);
      expect(response.end).not.toBe(null);
    } catch (error) {
      fail(error);
    }
  });
  it("#setWifiApDhcp works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      await client.setWifiApDhcp('100', '150');
    } catch (error) {
      fail(error);
    }
  });
  it("#disableWifiApDhcp works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      await client.disableWifiApDhcp();
    } catch (error) {
      fail(error);
    }
  });
  it("#getWifiClientApInfo works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      let response = await client.getWifiClientApInfo();
      await Util.sleep(100);
      expect(response).toBeDefined();
      expect(response).not.toBe(null);
      expect(response.ssid).not.toBe(null);
      expect(response.mac).not.toBe(null);
    } catch (error) {
      fail(error);
    }
  });
  it("#getWifiClientApSignal works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      let response = await client.getWifiClientApSignal();
      await Util.sleep(100);
      expect(response).toBe('Disconnected');
    } catch (error) {
      fail(error);
    }
  });
  it("#getWifiClientIp works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      let response = await client.getWifiClientIp();
      await Util.sleep(100);
      expect(response).toBeDefined();
      expect(response).not.toBe(null);
      expect(response.dhcp).not.toBe(null);
      expect(response.ip).not.toBe(null);
      expect(response.mask).not.toBe(null);
      expect(response.gateway).not.toBe(null);
    } catch (error) {
      fail(error);
    }
  });
  it("#setWifiClientIpDhcp works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      await client.setWifiClientIpDhcp();
    } catch (error) {
      fail(error);
    }
  });
  it("#setWifiClientIpStatic works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      await client.setWifiClientIpStatic('0.0.0.0', '0.0.0.0', '0.0.0.0');
    } catch (error) {
      fail(error);
    }
  });
  it("#getWifiClientSsid works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      let response = await client.getWifiClientSsid();
      await Util.sleep(100);
      expect(response).toBe(wifiClientSsid);
    } catch (error) {
      fail(error);
    }
  });
  it("#setWifiClientSsid works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      await client.setWifiClientSsid('abc123');
    } catch (error) {
      fail(error);
    }
  });
  it("#getWifiClientAuth works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      let response = await client.getWifiClientAuth();
      await Util.sleep(100);
      expect(response).toBeDefined();
      expect(response).not.toBe(null);
      expect(response.auth).not.toBe(null);
      expect(response.encryption).not.toBe(null);
      expect(response.passphrase).not.toBe(null);
    } catch (error) {
      fail(error);
    }
  });
  it("#setWifiClientAuth works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    try {
      await client.connect();
      await client.setWifiClientAuth('WPA2PSK', 'AES', 'abcd1234');
    } catch (error) {
      fail(error);
    }
  });
});
