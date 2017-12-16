# `ledenet-ufo`
This NodeJS module provides an API for controlling [WiFi RGBW controllers made by LEDENET](https://www.amazon.com/dp/B00MDKOSN0/).

## Credits
- [sidoh](https://github.com/sidoh) for developing the [Ruby implementation](https://github.com/sidoh/ledenet_api) that gave me the inspiration (and a reference to compare against!) to write this module.
- [vikstrous](https://github.com/vikstrous) for developing a [Golang implementation](https://github.com/vikstrous/zengge-lightcontrol) for similar products under different brands, whose documentation on the UDP command protocol proved very useful.
- [Scapy](http://scapy.readthedocs.io/en/latest/) and [Packet Capture by Grey Shirts](https://play.google.com/store/apps/details?id=app.greyshirts.sslcapture), which I used to sniff the UDP and TCP behavior (respectively) of the [original Android app](https://play.google.com/store/apps/details?id=com.Zengge.LEDWifiMagicHome).

## License/Notices
- This code is licensed under the [MIT license](LICENSE).
- This code is not developed, maintained or supported in any way by LEDENET.
- I am not affiliated with LEDENET in any capacity.
