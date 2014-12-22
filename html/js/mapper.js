$(document).ready(function() {
	var map = L.map('map');
	var osmUrl = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
	var osmAttrib = 'Map data copyright <a href="http://openstreetmap.org">OpenStreetMap</a> contributors';
	var osm = new L.TileLayer(osmUrl, {minZoom: 8, maxZoom: 19, attribution: osmAttrib});

	var numMarkers = 10;

	map.setView(new L.LatLng(54.5842894, -2.8893719), 11);
	map.addLayer(osm);

	var circle = L.circle(map.getCenter(), 10000, {
		color: 'blue',
		fillColor: 'blue',
		fillOpacity: 0.1
	}).addTo(map);

	var markers = getMarkers();

	for(i=0; i<markers.length; i++){
		markers[i].addTo(map);
	}

	map.on('movestart', function(e){
		for(i=0; i<markers.length; i++){
			map.removeLayer(markers[i]);
		}
	});

	map.on('move', function(e){
		circle.setLatLng(map.getCenter());
	});

	map.on('moveend', function(e){
		circle.setLatLng(map.getCenter());
		markers = getMarkers();
		for(i=1; i<markers.length; i++){
			markers[i].addTo(map);
		}
	});

	function getMarkers(){
		markers = [];
		for(i=0; i<numMarkers; i++){
			markers.push(getMarker(map.getCenter()));
		}
		return markers;
	}

	function getMarker(latlng){
		// var radius = 6000;
		// var startlat = latlng.lat;
		// var startlng = latlng.lng;
		// var distance = Math.random() * radius; //Random distance within circle
		// var theta = Math.random() * 6.283; //Radom rotation in radians

		// var dx = distance * Math.cos(theta);
		// var dy = distance * Math.sin(theta);
		// var delta_longitude = dx/(111320 * Math.cos(startlat));
		// var delta_latitude = dy/110540;
		// var new_longitude = startlng + delta_longitude;
		// var new_latitude = startlat + delta_latitude;
		// return L.marker(L.latLng(new_latitude, new_longitude))

		var factor = 0.08;
		var lat = latlng.lat + Math.random() * factor * (Math.random() < 0.5 ? -1 : 1);
		var lng = latlng.lng + Math.random() * factor * (Math.random() < 0.5 ? -1 : 1);
		return L.marker(L.latLng(lat, lng));
	}


});

