global.lufo = Object.freeze({
  // require() specific to this module.
  // https://gist.github.com/branneman/8048520#7-the-wrapper
  require: function(name) {
    return require(__dirname + '/../' + name);
  }
});
