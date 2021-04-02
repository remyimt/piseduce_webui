#!/bin/bash

NAME=$1

cd /etc/openvpn/easy-rsa
. vars
./pkitool $NAME
