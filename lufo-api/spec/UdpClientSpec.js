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
    disconnect: function() {
      // Always pass null as the error.
      if (this._disconnectCallback) this._disconnectCallback(null);
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
  it("#connect works", async function() {
    const cb = jasmine.createSpy('connect');
    const client = new UdpClient(ufo, {host:serverHost});
    client.connect(cb);
    await Util.sleep(100);
    expect(cb).toHaveBeenCalled();
  });
  it("#getVersion works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr, recvVersion;
    client.connect(function() {
      client.getVersion(function(a, b) {
        recvErr = a;
        recvVersion = b;
      });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
    expect(recvVersion).toBe(version);
  });
  it("#reboot works", async function() {
    const cb = jasmine.createSpy('connect');
    const client = new UdpClient(ufo, {host:serverHost});
    client.connect(function() {
      client.reboot(cb);
    });
    await Util.sleep(100);
    expect(cb).toHaveBeenCalled();
  });
  it("#factoryReset works", async function() {
    const cb = jasmine.createSpy('connect');
    const client = new UdpClient(ufo, {host:serverHost});
    client.connect(function() {
      client.factoryReset(cb);
    });
    await Util.sleep(100);
    expect(cb).toHaveBeenCalled();
  });
  it("#getNtpServer works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr, recvIp;
    client.connect(function() {
      client.getNtpServer(function(a, b) {
        recvErr = a;
        recvIp = b;
      });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
    expect(recvIp).toBe(ntpServer);
  });
  it("#setNtpServer works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr;
    client.connect(function() {
      client.setNtpServer('1.2.3.4', function(a) { recvErr = a; });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
  });
  it("#setUdpPassword works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    const newPassword = 'blahblahblah';
    var recvErr;
    client.connect(function() {
      client.setUdpPassword(newPassword, function(a) { recvErr = a; });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
    expect(client._options.password).toBe(newPassword);
  });
  it("#setTcpPort works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr;
    client.connect(function() {
      client.setTcpPort('11111', function(a) { recvErr = a; });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
  });
  it("#getWifiAutoSwitch works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr, recvResult;
    client.connect(function() {
      client.getWifiAutoSwitch(function(a, b) {
        recvErr = a;
        recvResult = b;
      });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
    expect(recvResult).toBe(wifiAutoSwitch);
  });
  it("#setWifiAutoSwitch works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr;
    client.connect(function() {
      client.setWifiAutoSwitch('off', function(a) { recvErr = a; });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
  });
  it("#getWifiMode works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr, recvResult;
    client.connect(function() {
      client.getWifiMode(function(a, b) {
        recvErr = a;
        recvResult = b;
      });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
    expect(recvResult).toBe(wifiMode);
  });
  it("#setWifiMode works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr;
    client.connect(function() {
      client.setWifiMode('STA', function(a) { recvErr = a; });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
  });
  it("#doWifiScan works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr, recvResult;
    client.connect(function() {
      client.doWifiScan(function(a, b) {
        recvErr = a;
        recvResult = b;
      });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
    expect(recvResult).toBeDefined();
    expect(recvResult).not.toBe(null);
    const network = recvResult[0];
    expect(network).not.toBe(null);
    expect(network.channel).not.toBe(null);
    expect(network.ssid).not.toBe(null);
    expect(network.mac).not.toBe(null);
    expect(network.security).not.toBe(null);
    expect(network.strength).not.toBe(null);
  });
  it("#getWifiApIp works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr, recvResult;
    client.connect(function() {
      client.getWifiApIp(function(a, b) {
        recvErr = a;
        recvResult = b;
      });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
    expect(recvResult).toBeDefined();
    expect(recvResult).not.toBe(null);
    expect(recvResult.ip).not.toBe(null);
    expect(recvResult.mask).not.toBe(null);
  });
  it("#setWifiApIp works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr;
    client.connect(function() {
      client.setWifiApIp('0.0.0.0', '0.0.0.0', function(a) { recvErr = a; });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
  });
  it("#getWifiApBroadcast works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr, recvResult;
    client.connect(function() {
      client.getWifiApBroadcast(function(a, b) {
        recvErr = a;
        recvResult = b;
      });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
    expect(recvResult).toBeDefined();
    expect(recvResult).not.toBe(null);
    expect(recvResult.mode).not.toBe(null);
    expect(recvResult.ssid).not.toBe(null);
    expect(recvResult.channel).not.toBe(null);
  });
  it("#setWifiApBroadcast works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr;
    client.connect(function() {
      client.setWifiApBroadcast('bgn', '0.0.0.0', '7', function(a) { recvErr = a; });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
  });
  it("#getWifiApPassphrase works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr, recvResult;
    client.connect(function() {
      client.getWifiApPassphrase(function(a, b) {
        recvErr = a;
        recvResult = b;
      });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
    expect(recvResult).toBe(wifiApPassphrase);
  });
  it("#setWifiApPassphrase works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr;
    client.connect(function() {
      client.setWifiApPassphrase('abcd1234', function(a) { recvErr = a; });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
  });
  it("#getWifiApLed works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr, recvResult;
    client.connect(function() {
      client.getWifiApLed(function(a, b) {
        recvErr = a;
        recvResult = b;
      });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
    expect(recvResult).toBe(true);
  });
  it("#setWifiApLed works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr;
    client.connect(function() {
      client.setWifiApLed(true, function(a) { recvErr = a; });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
  });
  it("#getWifiApDhcp works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr, recvResult;
    client.connect(function() {
      client.getWifiApDhcp(function(a, b) {
        recvErr = a;
        recvResult = b;
      });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
    expect(recvResult).toBeDefined();
    expect(recvResult).not.toBe(null);
    expect(recvResult.on).not.toBe(null);
    expect(recvResult.start).not.toBe(null);
    expect(recvResult.end).not.toBe(null);
  });
  it("#setWifiApDhcp works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr;
    client.connect(function() {
      client.setWifiApDhcp('100', '150', function(a) { recvErr = a; });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
  });
  it("#disableWifiApDhcp works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr;
    client.connect(function() {
      client.disableWifiApDhcp(function(a) { recvErr = a; });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
  });
  it("#getWifiClientApInfo works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr, recvResult;
    client.connect(function() {
      client.getWifiClientApInfo(function(a, b) {
        recvErr = a;
        recvResult = b;
      });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
    expect(recvResult).toBeDefined();
    expect(recvResult).not.toBe(null);
    expect(recvResult.ssid).not.toBe(null);
    expect(recvResult.mac).not.toBe(null);
  });
  it("#getWifiClientApSignal works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr, recvResult;
    client.connect(function() {
      client.getWifiClientApSignal(function(a, b) {
        recvErr = a;
        recvResult = b;
      });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
    expect(recvResult).toBe('Disconnected');
  });
  it("#getWifiClientIp works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr, recvResult;
    client.connect(function() {
      client.getWifiClientIp(function(a, b) {
        recvErr = a;
        recvResult = b;
      });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
    expect(recvResult).toBeDefined();
    expect(recvResult).not.toBe(null);
    expect(recvResult.dhcp).not.toBe(null);
    expect(recvResult.ip).not.toBe(null);
    expect(recvResult.mask).not.toBe(null);
    expect(recvResult.gateway).not.toBe(null);
  });
  it("#setWifiClientIpDhcp works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr;
    client.connect(function() {
      client.setWifiClientIpDhcp(function(a) { recvErr = a; });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
  });
  it("#setWifiClientIpStatic works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr;
    client.connect(function() {
      client.setWifiClientIpStatic('0.0.0.0', '0.0.0.0', '0.0.0.0', function(a) { recvErr = a; });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
  });
  it("#getWifiClientSsid works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr, recvResult;
    client.connect(function() {
      client.getWifiClientSsid(function(a, b) {
        recvErr = a;
        recvResult = b;
      });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
    expect(recvResult).toBe(wifiClientSsid);
  });
  it("#setWifiClientSsid works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr;
    client.connect(function() {
      client.setWifiClientSsid('abc123', function(a) { recvErr = a; });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
  });
  it("#getWifiClientAuth works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr, recvResult;
    client.connect(function() {
      client.getWifiClientAuth(function(a, b) {
        recvErr = a;
        recvResult = b;
      });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
    expect(recvResult).toBeDefined();
    expect(recvResult).not.toBe(null);
    expect(recvResult.auth).not.toBe(null);
    expect(recvResult.encryption).not.toBe(null);
    expect(recvResult.passphrase).not.toBe(null);
  });
  it("#setWifiClientAuth works", async function() {
    const client = new UdpClient(ufo, {host:serverHost});
    var recvErr;
    client.connect(function() {
      client.setWifiClientAuth('WPA2PSK', 'AES', 'abcd1234', function(a) { recvErr = a; });
    });
    await Util.sleep(100);
    expect(recvErr).toBe(null);
  });
});
