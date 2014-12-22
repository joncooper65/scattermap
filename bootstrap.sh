#!/bin/sh

echo "About to install Apache2"
apt-get update
apt-get install -y apache2
if ! [ -L /var/www ]; then
  rm -rf /var/www
  ln -fs /vagrant /var/www
fi
mkdir /vagrant/html
