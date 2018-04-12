const { TcpClient } = require('../lib/TcpClient');
const net = require('net');
const serverHost = '127.0.0.1';
const defaultPort = 5577;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe("TcpClient#constructorNonDefault", function() {
  var server = net.createServer();
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

describe("TcpClient#constructor", function() {
  var server = net.createServer();
  beforeEach(async function() {
    server.listen(defaultPort, serverHost);
    while (!server.listening) await sleep(100);
  });
  afterEach(async function() {
    server.close();
    while (server.listening) await sleep(100);
  });
  it("applies correct defaults", function() {
    const client = new TcpClient(null, {host:serverHost});
    expect(client._options.localPort).toBe(-1);
    expect(client._options.localAddress).toBe('');
    expect(client._options.remotePort).toBe(defaultPort);
    expect(client._options.remoteAddress).toBe(serverHost);
    expect(client._options.immediate).toBe(true);
  });
});

describe("TcpClient#connect", function() {
  var server = net.createServer();
  beforeEach(async function() {
    server.listen(defaultPort, serverHost);
    while (!server.listening) await sleep(100);
  });
  afterEach(async function() {
    server.close();
    while (server.listening) await sleep(100);
  });
  it("works", async function() {
    const cb = { connect: function() {} };
    spyOn(cb, 'connect');
    const client = new TcpClient(null, {host:serverHost});
    client.connect(cb.connect);
    await sleep(100);
    expect(cb.connect).toHaveBeenCalled();
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
