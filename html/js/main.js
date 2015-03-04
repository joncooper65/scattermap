require.config({
  paths:{
    "jquery": "../vendor/jquery/jquery.min",
    "jquerymobile": "../vendor/jquery-mobile-bower/js/jquery.mobile-1.4.2.min",
    "leaflet": "../vendor/leaflet/dist/leaflet"
  }
});

require(["jquery", "jquerymobile", "leaflet"], function($, jquerymobile, L){
  $(document).ready(function() {
    var map;
    var features;
    var numMarkers = 10;
    initialise();

    function initialise(){
      map = L.map("map",{
        zoom: 10,
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
      map.locate({setView: true, zoom: 10});
      map.on("locationfound", onLocationFound);
      map.on("locationerror", onLocationError);
    }

    function onLocationFound(e){
        getRecords();

      map.on("movestart", function(e){
        if (typeof geojsonlayer != "undefined"){
          map.removeLayer(geojsonlayer);
        }
      });

      map.on("move", function(e){
      });

      map.on("moveend", function(e){
      	getRecords();
      });

    }

    function getGbifQuery(){
        bounds = map.getBounds();
        return 'http://api.gbif.org/v1/occurrence/search?decimalLongitude=' 
                     + bounds.getWest() + ',' + bounds.getEast() + '&'
                     + '&decimalLatitude=' + bounds.getSouth() + ',' + bounds.getNorth()
                     + '&limit=100'
                     + '&callback=processRecords';
    }

    function getRecords(){
        var url = getGbifQuery();
        $.ajax({
            type: 'GET',
            url: url,
            async: false,
            jsonpCallback: 'processRecords',
            contentType: "application/json",
            dataType: 'jsonp',
            success: function(json) {
                console.dir('implement paging!  Number of records this time: ' + json.count);
                records = [];
                $.each(json.results, function(index, value){
                    records.push({"type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [getNoise(value.decimalLongitude), getNoise(value.decimalLatitude)]},
                        "properties": {"species": value.species}
                    });
                });
                geojsonlayer = L.geoJson(records, {
                    onEachFeature: onEachFeature
                }).addTo(map);
            },
            error: function(e) {
                console.log(e.message);
            }
        });
    }

    function getNoise(value){
        return value + Math.random() * 0.0001 * (Math.random() < 0.5 ? -1 : 1);
    }

    function onLocationError(e){
      alert(e.message);
    }

    function onEachFeature(feature, layer){
      if(feature.properties && feature.properties.species){
        layer.bindPopup(feature.properties.species);
      }
    }
  });

});
