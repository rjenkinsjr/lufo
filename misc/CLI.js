#! /usr/bin/env node
const UFO = require('../UFO');
const util = require('util');

var cli = require('commander');
cli.version(require('../package.json').version)
  .option('-u, --ufo <ip>', 'Specify UFO IP address')
  .parse(process.argv);

if (cli.host) {
  var ufoOptions = {
    host: cli.host
  }
  var ufo = new UFO(ufoOptions, function() {
    ufo.getTcpPort(function(err, result) {
      if (err) console.log(err, err.stack);
      else console.log(`Result: ${util.inspect(result)}`);
    });
  });
}
