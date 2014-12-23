$(document).ready(function() {
	var map;
	var circle;
	var features;
	var numMarkers = 10;
	initialise();

	function initialise(){
		map = L.map('map',{
			center: new L.LatLng(54.5842894, -2.8893719),
			zoom: 11,
			dragging: true,
			touchZoom: true,
			tap: false,
			inertia: true,
			inertiaDeceleration: 3000,
			inertiaMaxSpeed: 1500,
			tap: true,
		});
		L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', 
			{
				minZoom: 8, 
				maxZoom: 19, 
				attribution: 'Map data copyright <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
			}
		).addTo(map);
		circle = L.circle(map.getCenter(), 10000, {
			color: 'blue',
			fillColor: 'blue',
			fillOpacity: 0.1
		}).addTo(map);
		map.fitBounds(circle.getBounds())
	}

	function onEachFeature(feature, layer){
		if(feature.properties && feature.properties.species){
			layer.bindPopup(feature.properties.species);
		}
	}

	  map.on('movestart', function(e){
	  	map.removeLayer(geojsonlayer);
	  });

	 map.on('move', function(e){
	 	circle.setLatLng(map.getCenter());
	 });

  map.on('moveend', function(e){
  	circle.setLatLng(map.getCenter());
  	features = getFeatures();
  	geojsonlayer = L.geoJson(features, {
 			onEachFeature: onEachFeature
	 	}).addTo(map);
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
