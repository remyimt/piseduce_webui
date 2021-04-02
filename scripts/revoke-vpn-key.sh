#!/bin/bash

NAME=$1

rm vpn_keys/$NAME.conf
cd /etc/openvpn/easy-rsa
. vars
./revoke-full $NAME
rm /etc/openvpn/server/ccd/$NAME
systemctl restart openvpn-server@server 
