const { TcpClient } = require('../lib/TcpClient');
const net = require('net');
const serverHost = '127.0.0.1';
const defaultPort = 5577;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
    while (!server.listening) await sleep(100);
  });
  afterEach(async function() {
    server.close();
    while (server.listening) await sleep(100);
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
    while (!server.listening) await sleep(100);
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
    await sleep(100);
    expect(cb).toHaveBeenCalled();
  });
  it("#on works", async function() {
    const client = new TcpClient(null, {host:serverHost});
    client.connect(function() { client.on(); });
    await sleep(100);
    expect(recv.length).toBe(1);
    expect(recv[0]).toEqual(Buffer.from([0x71, 0x23, 0x0F, 0xA3]));
  });
  it("#off works", async function() {
    const client = new TcpClient(null, {host:serverHost});
    client.connect(function() { client.off(); });
    await sleep(100);
    expect(recv.length).toBe(1);
    expect(recv[0]).toEqual(Buffer.from([0x71, 0x24, 0x0F, 0xA4]));
  });
  it("#rgbw works", async function() {
    const client = new TcpClient(null, {host:serverHost});
    client.connect(function() { client.rgbw(255, 255, 255, 255); });
    await sleep(100);
    expect(recv.length).toBe(1);
    expect(recv[0]).toEqual(Buffer.from([0x31, 0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x0F, 0x3C]));
  });
  it("#rgbw clamps out-of-range values", async function() {
    const client = new TcpClient(null, {host:serverHost});
    client.connect(function() { client.rgbw(256, -1, 256, -1); });
    await sleep(100);
    expect(recv.length).toBe(1);
    expect(recv[0]).toEqual(Buffer.from([0x31, 0xFF, 0x00, 0xFF, 0x00, 0x00, 0x0F, 0x3E]));
  });
  it("#builtin works", async function() {
    const client = new TcpClient(null, {host:serverHost});
    client.connect(function() { client.builtin('redGradualChange', 75); });
    await sleep(100);
    expect(recv.length).toBe(1);
    expect(recv[0]).toEqual(Buffer.from([0x61, 0x26, 0x19, 0x0F, 0xAF]));
  });
  it("#builtin clamps out-of-range values", async function() {
    const client = new TcpClient(null, {host:serverHost});
    client.connect(function() { client.builtin('redGradualChange', 101); });
    await sleep(100);
    expect(recv.length).toBe(1);
    expect(recv[0]).toEqual(Buffer.from([0x61, 0x26, 0x00, 0x0F, 0x96]));
  });
  it("#builtin rejects invalid function names", async function() {
    const funcName = 'doesNotExist';
    const cb = jasmine.createSpy('builtin');
    const client = new TcpClient(null, {host:serverHost});
    client.connect(function() { client.builtin(funcName, 0, cb); });
    await sleep(100);
    expect(recv.length).toBe(0);
    expect(cb).toHaveBeenCalled();
    expect(cb.calls.first().args.length).toBe(1);
    const error = cb.calls.first().args[0];
    expect(error instanceof Error).toBe(true);
    expect(error.message).toBe(`No such built-in function ${funcName}`);
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
