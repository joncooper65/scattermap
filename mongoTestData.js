/*
A script to populate mongo with geojson points randomly scattered with the bbox of the UK.
To use it you need mongo running locally on default port, then open up a mongo console window (eg at linux prompt type mongo) and run load("mongoTestData.js") - add path as required
The UK bbox I've used is: west -9.23, east 2.69, north 60.85, south 49.84

Mongo installation: http://docs.mongodb.org/manual/tutorial/install-mongodb-on-ubuntu/
  sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10
  echo 'deb http://downloads-distro.mongodb.org/repo/ubuntu-upstart dist 10gen' | sudo tee /etc/apt/sources.list.d/mongodb.list
  sudo apt-get update
  sudo apt-get install -y mongodb-org
*/


function insertData(dbName, collectionName, numPoints){
	var col = db.getSiblingDB(dbName).getCollection(collectionName);
	for(var i=0; i<numPoints; i++){
		col.insert(getPoint());
	}
}

function getPoint(){
	return {"type": "Feature",
		"geometry": {"type": "Point", "coordinates": [getLon(), getLat()]},
		"properties": {"species": "banana"}
      };
}

function getLat(){
	return 49.84 + (Math.random() * 11.01);
}

function getLon(){
	return -9.23 + (Math.random() * 11.92);
}

var dbName = 'mydb';
var collectionName = 'testData';
var numPoints = 1000;
insertData(dbName, collectionName, numPoints);

