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

	map.fitBounds(circle.getBounds())

	function onEachFeature(feature, layer){
		if(feature.properties && feature.properties.species){
			layer.bindPopup(feature.properties.species);
		}
	}

	var features = getFeatures();
	var geojsonlayer = L.geoJson(features, {
		onEachFeature: onEachFeature
	}).addTo(map);

	 map.on('movestart', function(e){
	 	map.removeLayer(geojsonlayer);
	 });

	 map.on('moveend', function(e){
	 	circle.setLatLng(map.getCenter());
	 	features = getFeatures();
	 	geojsonlayer = L.geoJson(features, {
			onEachFeature: onEachFeature
		}).addTo(map);
	 });

	map.on('move', function(e){
		circle.setLatLng(map.getCenter());
	});

	function getFeatures(){
		features = [];
		for(i=0; i<numMarkers; i++){
			features.push(getFeature(map.getCenter()));
		}
		return features;
	}

	function getFeature(latlng){
		var factor = 0.08;
		var lat = latlng.lat + Math.random() * factor * (Math.random() < 0.5 ? -1 : 1);
		var lng = latlng.lng + Math.random() * factor * (Math.random() < 0.5 ? -1 : 1);

		return {"type": "Feature",
							"geometry": {"type": "Point", "coordinates": [lng, lat]},
							"properties": {"species": "banana"}
						};
	}

});
