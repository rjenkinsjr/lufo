#!/bin/bash
(echo -e -n 'HF-A11ASSISTHREAD'; sleep .5; echo -e -n '+ok'; sleep .5; echo -e -n "AT+$2\r"; sleep .5; echo -e -n "AT+Q\r") | socat - udp-datagram:$1:48899
