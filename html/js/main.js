require.config({
  paths:{
    "jquery": "../vendor/jquery/dist/jquery.min",
    "jquery.mobile": "../vendor/jquery-mobile/js/jquery.mobile",
    "leaflet": "../vendor/leaflet/dist/leaflet"
  }
});

require(["jquery", "jquery.mobile", "leaflet"], function($, jquerymobile, L){

  $(document).ready(function() {
    var map;
    var circle;
    var features;
    var numMarkers = 10;
    initialise();

    function initialise(){
      map = L.map("map",{
        zoom: 11,
        dragging: true,
        touchZoom: true,
        tap: false,
        inertia: true,
        inertiaDeceleration: 3000,
        inertiaMaxSpeed: 1500,
        tap: true,
      });

      L.tileLayer("http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", 
        {
          minZoom: 1, 
          maxZoom: 20, 
          attribution: "Map data copyright <a href='http://openstreetmap.org'>OpenStreetMap</a> contributors"
        }
      ).addTo(map);
      map.locate({setView: true, maxZoom: 12});
      map.on("locationfound", onLocationFound);
      map.on("locationerror", onLocationError);
    }

    function onLocationFound(e){
      console.log(e);
      console.log(e.latlng);
      circle = L.circle(e.latlng, 10000, {
        color: "blue",
        fillColor: "blue",
        fillOpacity: 0.1
      }).addTo(map);
      addFeatures();

      map.on("movestart", function(e){
        if (typeof geojsonlayer != "undefined"){
          map.removeLayer(geojsonlayer);
        }
      });

      map.on("move", function(e){
        circle.setLatLng(map.getCenter());
      });

      map.on("moveend", function(e){
        circle.setLatLng(map.getCenter());
        addFeatures();
      });

    }

    function onLocationError(e){
      alert(e.message);
    }

    function addFeatures(){
      features = getFeatures();
      geojsonlayer = L.geoJson(features, {
         onEachFeature: onEachFeature
       }).addTo(map);
    }

    function onEachFeature(feature, layer){
      if(feature.properties && feature.properties.species){
        layer.bindPopup(feature.properties.species);
      }
    }

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
});
