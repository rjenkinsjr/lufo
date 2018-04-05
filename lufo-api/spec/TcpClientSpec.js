const { TcpClient } = require('../lib/TcpClient');

describe("TcpClient.getBuiltinFunctions", function() {
  it("does not contain reserved function names", function() {
    const functions = TcpClient.getBuiltinFunctions();
    expect(functions).not.toContain('noFunction');
    expect(functions).not.toContain('postReset');
  });
});

describe("TcpClient.isNullStep", function() {
  it("does not consider non-objects as null steps", function() {
    expect(TcpClient.isNullStep(true)).toBe(false);
  });
});
