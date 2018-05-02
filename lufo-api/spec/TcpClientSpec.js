const Util = require('./Util');
const { TcpClient } = require('../lib/TcpClient');
const net = require('net');

const serverHost = '127.0.0.1';
const defaultPort = 5577;

describe("TcpClient#constructorNonDefault", function() {
  const server = net.createServer();
  const options = {
    localTcpPort: 1234,
    localHost: 'localhost',
    remoteTcpPort: 4477,
    host: serverHost,
    immediate: false
  };
  beforeEach(async function() {
    server.listen(options.remoteTcpPort, serverHost);
    while (!server.listening) await Util.sleep(100);
  });
  afterEach(async function() {
    server.close();
    while (server.listening) await Util.sleep(100);
  });
  it("accepts default overrides", function() {
    const client = new TcpClient(null, options);
    expect(client._options.localPort).toBe(options.localTcpPort);
    expect(client._options.localAddress).toBe(options.localHost);
    expect(client._options.remotePort).toBe(options.remoteTcpPort);
    expect(client._options.remoteAddress).toBe(options.host);
    expect(client._options.immediate).toBe(false);
  });
});

describe("TcpClient", function() {
  var server, recv;
  beforeEach(async function() {
    server = net.createServer();
    recv = [];
    server.on('connection', function(socket) {
      socket.on('data', function(data) {
        recv.push(data);
      });
    });
    server.listen(defaultPort, serverHost);
    while (!server.listening) await Util.sleep(100);
  });
  afterEach(function() { server.close(); });
  it("#constructor applies correct defaults", function() {
    const client = new TcpClient(null, {host:serverHost});
    expect(client._options.localPort).toBe(-1);
    expect(client._options.localAddress).toBe('');
    expect(client._options.remotePort).toBe(defaultPort);
    expect(client._options.remoteAddress).toBe(serverHost);
    expect(client._options.immediate).toBe(true);
  });
  it("#connect works", async function() {
    const cb = jasmine.createSpy('connect');
    const client = new TcpClient(null, {host:serverHost});
    client.connect(cb);
    await Util.sleep(100);
    expect(cb).toHaveBeenCalled();
  });
  it("#on works", async function() {
    const client = new TcpClient(null, {host:serverHost});
    client.connect(function() { client.on(); });
    await Util.sleep(100);
    expect(recv.length).toBe(1);
    expect(recv[0]).toEqual(Buffer.from([0x71, 0x23, 0x0F, 0xA3]));
  });
  it("#off works", async function() {
    const client = new TcpClient(null, {host:serverHost});
    client.connect(function() { client.off(); });
    await Util.sleep(100);
    expect(recv.length).toBe(1);
    expect(recv[0]).toEqual(Buffer.from([0x71, 0x24, 0x0F, 0xA4]));
  });
  it("#rgbw works", async function() {
    const client = new TcpClient(null, {host:serverHost});
    client.connect(function() { client.rgbw(255, 255, 255, 255); });
    await Util.sleep(100);
    expect(recv.length).toBe(1);
    expect(recv[0]).toEqual(Buffer.from([0x31, 0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x0F, 0x3C]));
  });
  it("#rgbw clamps out-of-range values", async function() {
    const client = new TcpClient(null, {host:serverHost});
    client.connect(function() { client.rgbw(256, -1, 256, -1); });
    await Util.sleep(100);
    expect(recv.length).toBe(1);
    expect(recv[0]).toEqual(Buffer.from([0x31, 0xFF, 0x00, 0xFF, 0x00, 0x00, 0x0F, 0x3E]));
  });
  it("#builtin works", async function() {
    const client = new TcpClient(null, {host:serverHost});
    client.connect(function() { client.builtin('redGradualChange', 75); });
    await Util.sleep(100);
    expect(recv.length).toBe(1);
    expect(recv[0]).toEqual(Buffer.from([0x61, 0x26, 0x19, 0x0F, 0xAF]));
  });
  it("#builtin clamps out-of-range values", async function() {
    const client = new TcpClient(null, {host:serverHost});
    client.connect(function() { client.builtin('redGradualChange', 101); });
    await Util.sleep(100);
    expect(recv.length).toBe(1);
    expect(recv[0]).toEqual(Buffer.from([0x61, 0x26, 0x00, 0x0F, 0x96]));
  });
  it("#builtin rejects invalid function names", async function() {
    const funcName = 'doesNotExist';
    const cb = jasmine.createSpy('builtin');
    const client = new TcpClient(null, {host:serverHost});
    client.connect(function() { client.builtin(funcName, 0, cb); });
    await Util.sleep(100);
    expect(recv.length).toBe(0);
    expect(cb).toHaveBeenCalled();
    expect(cb.calls.first().args.length).toBe(1);
    const error = cb.calls.first().args[0];
    expect(error instanceof Error).toBe(true);
    expect(error.message).toBe(`No such built-in function ${funcName}`);
  });
  it("#custom works", async function() {
    const client = new TcpClient(null, {host:serverHost});
    client.connect(function() { client.custom('gradual', 10, [
      { red: 255, green: 0, blue: 0 },
      { red: 0, green: 255, blue: 0 },
      { red: 0, green: 0, blue: 255 },
    ]); });
    await Util.sleep(100);
    expect(recv.length).toBe(1);
    expect(recv[0]).toEqual(Buffer.from([0x51,
      0xFF, 0x00, 0x00, 0x00,
      0x00, 0xFF, 0x00, 0x00,
      0x00, 0x00, 0xFF, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x15, 0x3A,
    0xFF, 0x0F, 0xF9]));
  });
  it("#custom clamps out-of-range values", async function() {
    const client = new TcpClient(null, {host:serverHost});
    client.connect(function() { client.custom('jumping', 40, [
      { red: 256, green: -1, blue: -1 },
      { red: 0, green: 255, blue: 0 },
      { red: 0, green: 0, blue: 255 },
    ]); });
    await Util.sleep(100);
    expect(recv.length).toBe(1);
    expect(recv[0]).toEqual(Buffer.from([0x51,
      0xFF, 0x00, 0x00, 0x00,
      0x00, 0xFF, 0x00, 0x00,
      0x00, 0x00, 0xFF, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x3B,
    0xFF, 0x0F, 0xE6]));
  });
  it("#custom strips out null steps", async function() {
    const client = new TcpClient(null, {host:serverHost});
    client.connect(function() { client.custom('strobe', 30, [
      { red: 1, green: 2, blue: 3 },
      { red: 255, green: 0, blue: 0 },
      { red: 0, green: 255, blue: 0 },
      { red: 0, green: 0, blue: 255 },
    ]); });
    await Util.sleep(100);
    expect(recv.length).toBe(1);
    expect(recv[0]).toEqual(Buffer.from([0x51,
      0xFF, 0x00, 0x00, 0x00,
      0x00, 0xFF, 0x00, 0x00,
      0x00, 0x00, 0xFF, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x02, 0x03, 0x00,
      0x01, 0x3C,
    0xFF, 0x0F, 0xE7]));
  });it("#custom silently drops more than 16 steps", async function() {
    const client = new TcpClient(null, {host:serverHost});
    client.connect(function() { client.custom('strobe', 30, [
      { red: 255, green: 0, blue: 0 },
      { red: 0, green: 255, blue: 0 },
      { red: 0, green: 0, blue: 255 },
      { red: 255, green: 0, blue: 0 },
      { red: 0, green: 255, blue: 0 },
      { red: 0, green: 0, blue: 255 },
      { red: 255, green: 0, blue: 0 },
      { red: 0, green: 255, blue: 0 },
      { red: 0, green: 0, blue: 255 },
      { red: 255, green: 0, blue: 0 },
      { red: 0, green: 255, blue: 0 },
      { red: 0, green: 0, blue: 255 },
      { red: 255, green: 0, blue: 0 },
      { red: 0, green: 255, blue: 0 },
      { red: 0, green: 0, blue: 255 },
      { red: 255, green: 0, blue: 0 },
      { red: 0, green: 255, blue: 0 },
      { red: 0, green: 0, blue: 255 },
    ]); });
    await Util.sleep(100);
    expect(recv.length).toBe(1);
    expect(recv[0]).toEqual(Buffer.from([0x51,
      0xFF, 0x00, 0x00, 0x00,
      0x00, 0xFF, 0x00, 0x00,
      0x00, 0x00, 0xFF, 0x00,
      0xFF, 0x00, 0x00, 0x00,
      0x00, 0xFF, 0x00, 0x00,
      0x00, 0x00, 0xFF, 0x00,
      0xFF, 0x00, 0x00, 0x00,
      0x00, 0xFF, 0x00, 0x00,
      0x00, 0x00, 0xFF, 0x00,
      0xFF, 0x00, 0x00, 0x00,
      0x00, 0xFF, 0x00, 0x00,
      0x00, 0x00, 0xFF, 0x00,
      0xFF, 0x00, 0x00, 0x00,
      0x00, 0xFF, 0x00, 0x00,
      0x00, 0x00, 0xFF, 0x00,
      0xFF, 0x00, 0x00, 0x00,
      0x01, 0x3C,
    0xFF, 0x0F, 0x8C]));
  });
});

describe("TcpClient#status", function() {
  var server, recv, sendResponse;
  beforeEach(async function() {
    server = net.createServer();
    recv = [];
    // 0x81 ???a POWER MODE ???b SPEED RED GREEN BLUE WHITE [UNUSED] CHECKSUM
    sendResponse = null;
    server.on('connection', function(socket) {
      socket.on('data', function(data) {
        recv.push(data);
        socket.write(sendResponse);
      });
    });
    server.listen(defaultPort, serverHost);
    while (!server.listening) await Util.sleep(100);
  });
  afterEach(function() { server.close(); });
  it('static mode', async function() {
    sendResponse = Buffer.from([0x81, 0x04,
      0x23, 0x61,
      0x21,
      0x00,
      0xFF, 0xFF, 0xFF, 0xFF,
      0x03, 0x00, 0x00,
    0x29]);
    const client = new TcpClient(null, {host:serverHost});
    var err, status;
    client.connect(function() { client.status(function(a, b) {
      err = a;
      status = b;
    })});
    await Util.sleep(100);
    expect(recv.length).toBe(1);
    expect(recv[0]).toEqual(Buffer.from([0x81, 0x8A, 0x8B, 0x96]));
    expect(err).toBe(null);
    expect(status).toBeDefined();
    expect(status.raw).toEqual(sendResponse);
    expect(status.on).toBe(true);
    expect(status.mode).toBe('static');
    expect(status.speed).toBeUndefined();
    expect(status.red).toBe(255);
    expect(status.green).toBe(255);
    expect(status.blue).toBe(255);
    expect(status.white).toBe(255);
  });
  it('custom mode', async function() {
    sendResponse = Buffer.from([0x81, 0x04,
      0x23, 0x60,
      0x21,
      0x00,
      0xFF, 0xFF, 0xFF, 0xFF,
      0x03, 0x00, 0x00,
    0x28]);
    const client = new TcpClient(null, {host:serverHost});
    var err, status;
    client.connect(function() { client.status(function(a, b) {
      err = a;
      status = b;
    })});
    await Util.sleep(100);
    expect(recv.length).toBe(1);
    expect(recv[0]).toEqual(Buffer.from([0x81, 0x8A, 0x8B, 0x96]));
    expect(err).toBe(null);
    expect(status).toBeDefined();
    expect(status.raw).toEqual(sendResponse);
    expect(status.on).toBe(true);
    expect(status.mode).toBe('custom');
    expect(status.speed).toBe(30);
    expect(status.red).toBe(255);
    expect(status.green).toBe(255);
    expect(status.blue).toBe(255);
    expect(status.white).toBe(255);
  });
  it('function mode', async function() {
    sendResponse = Buffer.from([0x81, 0x04,
      0x23, 0x25,
      0x21,
      0x00,
      0xFF, 0xFF, 0xFF, 0xFF,
      0x03, 0x00, 0x00,
    0xED]);
    const client = new TcpClient(null, {host:serverHost});
    var err, status;
    client.connect(function() { client.status(function(a, b) {
      err = a;
      status = b;
    })});
    await Util.sleep(100);
    expect(recv.length).toBe(1);
    expect(recv[0]).toEqual(Buffer.from([0x81, 0x8A, 0x8B, 0x96]));
    expect(err).toBe(null);
    expect(status).toBeDefined();
    expect(status.raw).toEqual(sendResponse);
    expect(status.on).toBe(true);
    expect(status.mode).toBe('function:sevenColorCrossFade');
    expect(status.speed).toBe(100);
    expect(status.red).toBe(255);
    expect(status.green).toBe(255);
    expect(status.blue).toBe(255);
    expect(status.white).toBe(255);
  });
});

describe("TcpClient.getBuiltinFunctions", function() {
  it("does not contain reserved function names", function() {
    const functions = TcpClient.getBuiltinFunctions();
    expect(functions).not.toContain('noFunction');
    expect(functions).not.toContain('postReset');
  });
});

describe("TcpClient.isNullStep", function() {
  it("does not consider non-objects as null steps", function() {
    expect(TcpClient.isNullStep(undefined)).toBe(false);
    expect(TcpClient.isNullStep(null)).toBe(false);
    expect(TcpClient.isNullStep(0)).toBe(false);
    expect(TcpClient.isNullStep("")).toBe(false);
    expect(TcpClient.isNullStep(true)).toBe(false);
    expect(TcpClient.isNullStep([])).toBe(false);
    expect(TcpClient.isNullStep(function(){})).toBe(false);
  });
  it("only considers objects with RGB properties", function() {
    expect(TcpClient.isNullStep({})).toBe(false);
    expect(TcpClient.isNullStep({red:1})).toBe(false);
    expect(TcpClient.isNullStep({green:2})).toBe(false);
    expect(TcpClient.isNullStep({blue:3})).toBe(false);
    expect(TcpClient.isNullStep({red:1,green:2})).toBe(false);
    expect(TcpClient.isNullStep({red:1,blue:3})).toBe(false);
    expect(TcpClient.isNullStep({green:2,blue:3})).toBe(false);
  });
  it("only allows { red: 1, green: 2, blue: 3 }", function() {
    expect(TcpClient.isNullStep({red:0,green:0,blue:0})).toBe(false);
    expect(TcpClient.isNullStep({red:255,green:255,blue:255})).toBe(false);
    expect(TcpClient.isNullStep({red:1,green:2,blue:3})).toBe(true);
  });
});
