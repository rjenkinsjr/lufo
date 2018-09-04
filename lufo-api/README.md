# `lufo-api`
An API for controlling [WiFi RGBW controllers made by LEDENET](https://www.amazon.com/dp/B00MDKOSN0/).

## Installing

`npm install lufo-api`

To include in your app:

```
import Ufo from 'lufo-api';
// ...or...
const Ufo = require('lufo-api');
```

## Examples

### Discovering UFOs
```
Ufo.discover()
  .then((ufos) => {
    // an array of objects that describe UFOs
  })
  .catch((err) => {
    // some error occurred
  });
```

### Using A UFO
```
let ufo = new Ufo({host: 192.168.1.2});
ufo.connect()
  .then(() => ufo.turnOn())
  .then(() => ufo.setBuiltin('sevenColorCrossFade', 100)) // 100 is fast, 0 is slow
  .then(() => ufo.disconnect())
  .then(() => { ... })
  .catch((err) => {
    // some error occurred
    // in most cases, the ufo object will be disconnected and unusable
  });
```

### Scanning For Wifi Networks
```
let ufo = new Ufo({host: 192.168.1.2});
ufo.connect()
  .then(() => ufo.doWifiScan())
  .then((networks) => {
    // an array of objects describing nearby Wifi networks (null SSID means a hidden network)
    return ufo.disconnect();
  })
  .then(() => { ... })
  .catch((err) => {
    // some error occurred
    // in most cases, the ufo object will be disconnected and unusable
  });
```

## API Reference

[https://rjenkinsjr.github.com/lufo/api/index.html](https://rjenkinsjr.github.com/lufo/api/index.html#ufo)

## Changelog

[https://github.com/rjenkinsjr/lufo/blob/master/README.md](https://github.com/rjenkinsjr/lufo/blob/master/README.md)
