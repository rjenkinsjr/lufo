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
      if (this._disconnectCallback) this._disconnectCallback();
    }
  }
  const ip = '0.0.0.0';
  const mac = '00:00:00:ff:ff:ff';
  const model = 'Dummy Model';
  const term = '\r\n\r\n';
  const ok = `ok${term}`;
  const version = 'abc123';
  const ntpServer = '1.2.3.4';
  beforeEach(async function() {
    server = dgram.createSocket({type:'udp4'});
    recv = [];
    listening = false;
    remotePort = -1;
    remoteAddr = '';
    cmdMode = false;
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
          server.send(`${version}${term}`, remotePort, remoteAddr);
          break;
        case 'AT+Z\r':
          // Reboot, so do nothing.
          cmdMode = false;
          break;
        case 'AT+RELD\r':
          server.send('rebooting...', remotePort, remoteAddr);
          break;
        case 'AT+NTPSER\r':
          server.send(`${ntpServer}${term}`, remotePort, remoteAddr);
          break;
        default:
          // Setters
          switch (true) {
            case /AT\+NTPSER=[^,]+\r/.test(message):
              server.send(ok, remotePort, remoteAddr);
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
});
