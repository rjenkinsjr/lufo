# `lufo-cli`
A CLI for controlling [WiFi RGBW controllers made by LEDENET](https://www.amazon.com/dp/B00MDKOSN0/).

## Installing

`npm install -g lufo-cli`

## Command Reference

### Usage and Options
`lufo [options] <command> [command-options ...]`
```
-V, --version
  Print the CLI version and exit.
-o, --ufo <ip>
  The UFO IP address; required for all commands except "discover" and "function-list".
  If unspecified, the LUFO_ADDRESS environment variable is used.
-p, --password [password]
  The UFO password. If set but with no value, you will be prompted.
  If unspecified, the LUFO_PASSWORD environment variable is used, or otherwise the default hardcoded password is used.
--local-host <localHost>
  The local host to use when opening the listener ports.
  If unspecified, the LUFO_LOCALHOST environment variable is used.
--local-udp <localUdpPort>
  The UDP port to use on this computer to search.
  If unspecified, the LUFO_LOCAL_UDP environment variable, or otherwise a random port is used.
-u, --remote-udp <remoteUdpPort>
  The UDP port to which expected UFOs are bound.
  If unspecified, the LUFO_REMOTE_UDP environment variable is used, or otherwise the default port 48899 is used.
--local-tcp <localTcpPort>
  The TCP port to use on this computer to search.
  If unspecified, the LUFO_LOCAL_TCP environment variable, or otherwise a random port is used.
-t, --remote-tcp <remoteTcpPort>
  The TCP port to which expected UFOs are bound.
  If unspecified, the LUFO_REMOTE_TCP environment variable is used, or otherwise the default port 5577 is used.
-i, --immediate
  If enabled, send TCP data immediately; otherwise, the CLI may buffer data before it is sent.
  If unspecified, the LUFO_IMMEDIATE environment variable is used, or otherwise it is enabled by default.
-h, --help
  Print usage info and exit.
```

### Subcommands
Commands marked {json} return well-formed JSON to stdout; no commands accept JSON input.

```
discover|d [timeout]
  Searches for UFOs on the network. Timeout is in seconds, defaults to 3. {json}
  The returned JSON array contains objects with properties "ip", ""mac" and "model".
status|s
  Returns the UFO's current status. {json}
  Reports power flag (on/off), RGBW values and mode.
  Mode is "static", "custom", "function:???" or "other".
  If "custom", speed is 0-30 inclusive.
  If "function:???", speed is 0-100 inclusive and the function name will follow the colon.
on
  Turns on UFO output.
off
  Turns off UFO output.
  Does not stop running builtin/custom functions; see "zero" and "freeze" commands.
toggle|t
  Toggles UFO output on/off.
rgbw|v <values...>
  Sets the UFO's output.
  Input values are R, G, B and W respectively, range 0-255 inclusive.
red|r [-s, --solo] <value>
  Sets the UFO's red output.
  Input range 0-255 inclusive.
  If --solo is set, all other output values are set to zero.
green|g [options] <value>
  Sets the UFO's green output.
  Input range 0-255 inclusive.
  If --solo is set, all other output values are set to zero.
blue|b [options] <value>
  Sets the UFO's blue output.
  Input range 0-255 inclusive.
  If --solo is set, all other output values are set to zero.
white|w [options] <value>
  Sets the UFO's white output.
  Input range 0-255 inclusive.
  If --solo is set, all other output values are set to zero.
function|f <name> <speed>
  Plays a built-in function.
  Speed is 0-100 (slow to fast) inclusive.
function-list
  Lists all possible built-in function names usable by the "function" command.
custom|c <type> <speed> [steps...]
  Plays a custom function.
  Type is "gradual", "jumping" or "strobe".
  Speed is 0-30 (slow to fast) inclusive.
  Each step is a comma-separated RGB triplets (each value in the triplet ranges 0-255 inclusive); maximum of 16 steps (extras are ignored).
zero|0
  Sets all UFO outputs to zero.
  Does not alter the power flag (see "on"/"off"/"toggle" commands).
freeze|z
  Stops whatever builtin/custom is playing.
  Output will remain on; use "zero" to stop and turn off output simultaneously.
version
  Returns the UFO's firmware version.
ntp [server]
  Gets/sets the NTP server.
password <pwd>
  Sets the UDP password.
port <port>
  Sets the TCP port.
wifi-scan
  Scans for nearby WiFi networks and returns their channel, SSID, AP MAC address, security config and signal strength. {json}
wifi-auto-switch [mode]
  Gets/sets the WiFi auto-switch setting.
  Possible values are (no quotes):
    "off" (AP mode will never turn on)
    "on" (AP mode will turn on after 1 minute)
    "auto" (after 10 minutes)
    3-120 inclusive (after X minutes)
wifi-mode [mode]
  Gets/sets the WiFi mode.
  Possible values are (no quotes): "AP", "STA" or "APSTA".
wifi-ap-ip [ip] [mask]
  Gets/sets the IP address/netmask when in AP mode. {json}
wifi-ap-broadcast [mode] [ssid] [channel]
  Gets/sets the WiFi broadcast info when in AP mode. {json}
  Mode is one of "b", "bg" or "bgn" (no quotes, case insensitive).
  SSID is 32 characters or less, ASCII only.
  Channel is 1-11 inclusive.
wifi-ap-passphrase [pwd]
  Gets/sets the WiFi passphrase when in AP mode.
  8-63 characters inclusive.
  Use "false" (no quotes) to disable security and configure the AP as an open network.
wifi-ap-led [value]
  Gets/sets the connection LED state when in AP mode.
  Any argument supplied other than "on" (no quotes) implies "off".
wifi-ap-dhcp [start] [end]
  Gets/sets the DHCP range when in AP mode.
  Ranges are 0-254 inclusive.
  Implicitly enables the DHCP server when setting; use the "wifi-ap-dhcp-disable" command to disable DHCP.
wifi-ap-dhcp-disable
  Disables the DHCP server when in AP mode.
wifi-client-ap-info
  Shows the connected AP's SSID/MAC address when in client mode. {json}
wifi-client-ap-signal
  Shows the connected AP signal strength when in client mode.
wifi-client-ip [ip] [mask] [gateway]
  Gets/sets the IP configuration when in client mode. {json}
  To use DHCP, pass only one argument "dhcp" or "DHCP" (no quotes); setting all 3 arguments implies static IP assignment.
wifi-client-ssid [ssid]
  Gets/sets the SSID when in client mode.
wifi-client-auth [auth] [encryption] [passphrase]
  Gets/sets the authentication parameters when in client mode. {json}
reboot
  Reboots the UFO.
factory-reset
  Resets the UFO to factory settings. No confirmation prompt will occur; USE CAUTION.
```

## Examples
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

lufo custom jumping 30 255,0,0 0,255,0 0,0,255 # Fast-moving RGB rotation
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
lufo wifi-client-auth WPA2PSK AES <your-passphrase>
# (Optional) Set the NTP server to something you know your UFOs can reach.
lufo ntp <server-ip>
# Reboot the UFO so these changes take effect.
# If you screwed up, you'll have to factory reset using the instructions included with the UFO and start over.
lufo reboot
# Your UFO should now connect to the wireless network whose SSID you specified. Connect to that network and discover it to verify it connected.
# You can also observe the UFO and wait for the blue LED to turn on, indicating that it is connected to the wireless network.
lufo d
```
