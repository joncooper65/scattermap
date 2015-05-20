Map My Wildife
=============

An app to map widlife records delivered from Gbif rest services.

Point your device at this to see a recent iteration: http://joncooper65.github.io/scattermap/

The vision is to have a location aware map sprinkled with interactive place markers displaying wildlife records.  The user can choose their preferences for common/scientific naming, earliest year and species group.  The placemarkers show species recorded there and the datasets they come from.  The map can be summarised to show common species, taxon group statistics, datasets accessed and date ranges.

The first iteration aims to take the Gbif services as far as they can go.  Since they aren't designed to support an app like this we want to find what works and what doesn't, and what further back end services are needed.  It will also drive out design and features we like.

dev notes
---------

Would like to move over to backbone, coffescript, freemarker and setup proper grunt tasks for building, dist, etc

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
