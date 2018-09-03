# `lufo`
[![CircleCI](https://circleci.com/gh/rjenkinsjr/lufo/tree/master.svg?style=svg)](https://circleci.com/gh/rjenkinsjr/lufo/tree/master)

These NodeJS modules provide an API and CLI for controlling [WiFi RGBW controllers made by LEDENET](https://www.amazon.com/dp/B00MDKOSN0/).

## Documentation
- [API](https://rjenkinsjr.github.com/lufo/api/index.html)
- [CLI](https://rjenkinsjr.github.com/lufo/cli)

## Unimplemented Features
The following features from the mobile app are not implemented and are unlikely to be implemented in the future:
- Remote access and device naming (these are cloud features; this module is intended to be used in closed/controlled environments)
- Device grouping and timers (you can use the API and write your own code to implement these features if you need them)
- Music/disco/camera modes (these features rely on your mobile device's hardware, making it impossible to replicate them)

## Credits
- [sidoh](https://github.com/sidoh) for developing the [Ruby implementation](https://github.com/sidoh/ledenet_api) that gave me the inspiration (and a reference to compare against!) to write this module.
- [vikstrous](https://github.com/vikstrous) for developing a [Golang implementation](https://github.com/vikstrous/zengge-lightcontrol) for similar products under different brands, whose documentation on the UDP command protocol proved very useful. Here's [a blog post](https://blog.viktorstanchev.com/2015/12/20/the-many-attacks-on-zengge-wifi-lightbulbs/) from the author describing ways to hack LED light bulbs made by the same manufacturer (command set is very similar).
- [Scapy](http://scapy.readthedocs.io/en/latest/) and [Packet Capture by Grey Shirts](https://play.google.com/store/apps/details?id=app.greyshirts.sslcapture), which I used to sniff the UDP and TCP behavior (respectively) of the [original Android app](https://play.google.com/store/apps/details?id=com.Zengge.LEDWifiMagicHome).

## License/Notices
- This code is licensed under the [MIT license](LICENSE).
- This code is not developed, maintained or supported in any way by LEDENET.
- I am not affiliated with LEDENET in any capacity.

## Changelog

### 0.2.0
Switch from callback-based API to Promise-based API.
*Tested against NodeJS versions 5.12.0 6.14.4 7.10.1 8.11.4 9.11.2 and 10.9.0.*

- API
    - Converted all public-facing methods (and most private methods) to produce/consume Promises
    - Fixed bug in `setWifiApDhcp` method where the start octet was accidentally used as both start and end octets
    - Add examples to README
- CLI
    - Fix --solo handling for red/green/blue/white commands
    - Fix --help formatting
    - Improve error logging
    - Other fixes
- Other
    - Drop support for NodeJS 4.x
    - Do not build the gh-pages branch in CircleCI
    - Fix Git tagging during the deploy process
    - Fix permissions on UDP test shell script
    - Add changelog

### 0.1.0
First release.
*Tested against NodeJS versions 4.8.7, 5.12.0, 6.13.1, 7.10.1, 8.10.0 and 9.9.0.*
