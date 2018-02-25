# `ledenet-ufo`
This NodeJS module provides an API for controlling [WiFi RGBW controllers made by LEDENET](https://www.amazon.com/dp/B00MDKOSN0/).

## Installing

```
npm install ledenet-ufo # API
npm install -g ledenet-ufo # CLI
```

## CLI Usage
All commands except `discover|d` require the `--ufo` or `-u` option, which specifies the IP address of the UFO. You can also use the `LUFO_ADDRESS` environment variable.

```
export LUFO_ADDRESS=1.2.3.4 # Use your UFO's IP address here
lufo on
lufo rgbw 255 0 0 0 # Red, 100%
lufo rgbw 0 127 0 0 # Green, 50%
lufo rgbw 0 0 63 # Blue, 25%
lufo rgbw 0 0 0 255 # White, 100%
lufo function sevenColorCrossFade 100 # Fast-moving seven-color fade loop
lufo status # JSON status object

{
  "power": "on",
  "mode": "function:sevenColorCrossFade",
  "speed": 100,
  "red": 255,
  "green": 98,
  "blue": 96,
  "white": 0
}

lufo custom jumping 30 255 0 0 0 255 0 0 0 255 # Fast-moving RGB rotation
lufo freeze # Stop whatever sequence is playing, but don't turn it off
lufo zero # Set all output to zero
```

## Setting Up/Hardening A New UFO
You can use the CLI to setup a new UFO so it is as secure as possible. These devices are inherently insecure; **as long as someone is on the same network and knows the UDP password and/or TCP port, they can exert some level of control over the UFO**, so it's your responsibility to secure the network to which your UFOs are connected.

You should setup one UFO at a time to avoid confusion during discovery.

First, power on the UFO and look for a wireless network whose name starts with `LEDnet` and is followed by 6 hexadecimal characters (this happens to be the last 6 characters of the UFO's MAC address). Connect to this network. If you can't find such a network, follow the instructions that came with the UFO to factory reset it.

After connecting, follow the steps below.

```
# Discover the UFO's IP address.
lufo d
# Export the environment variable for simpler CLI syntax below.
export LUFO_ADDRESS=1.2.3.4
# (MOST IMPORTANT) Change the UDP password so attackers cannot use the default password to discover/manage the UFO.
lufo password <password>
# Change the TCP port.
lufo port <port-number>
# Disable WiFi auto-switch (this "feature" enables the UFO's AP mode after a specified timeout if the UFO cannot connect in client mode...very easy to attack!)
lufo wifi-auto-switch off
# Use client mode only.
lufo wifi-mode STA
# Configure the client to use DHCP or static IP assignment. Configuring reserved DHCP on your router for each UFO's MAC address would be a good strategy here.
lufo wifi-client-ip dhcp
lufo wifi-client-ip <desired-ip> <netmask> <gateway-ip>
# Set the router's SSID and auth so the UFO can connect.
lufo wifi-client-ssid <your-ssid>
lufo wifi-client-auth WPA2PSK TKIP|AES <your-passphrase>
# (Optional) Set the NTP server to something you know your UFOs can reach.
lufo ntp <server-ip>
# Reboot the UFO so these changes take effect.
# If you screwed up, you'll have to factory reset using the instructions included with the UFO and start over.
lufo reboot
# Your UFO should now connect to the wireless network whose SSID you specified. Connect to that network and discover it to verify it connected.
# You can also observe the UFO and wait for the blue LED to turn on, indicating that it is connected to the wireless network.
lufo d
```

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
