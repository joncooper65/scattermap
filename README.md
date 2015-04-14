scattermap
==========

Working towards a responsive GeoJson mapper using leaflet, primarily for mapping and exploring plant and animal records in the UK.

Setup (can move these over to vagrant file eventually)
-----
sudo apt-get install nodejs

sudo apt-get install npm

sudo apt-get install git

sudo npm install -g bower 

will probably need to do: sudo ln -s /usr/bin/nodejs /usr/bin/node

bower install

mongodb install on linux: http://docs.monanual/tutorial/install-mongodb-on-ubuntu/

NOTE
----
http://askubuntu.com/questions/4983/what-are-ppas-and-how-do-i-use-them
probably need to add the following to linux's sources located in /etc/apt/sources.list (the tool above does this for you):
- deb http://ppa.launchpad.net/chris-lea/node.js/ubuntu trusty main 
- deb-src http://ppa.launchpad.net/chris-lea/node.js/ubuntu trusty main 

then do apt-get update followed by apt-get install nodejs - means you shouldn't need symbolic link step
