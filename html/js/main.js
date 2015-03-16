require.config({
  paths:{
    "jquery": "../vendor/jquery/jquery.min",
    "jquerymobile": "../vendor/jquery-mobile-bower/js/jquery.mobile-1.4.2.min",
    "leaflet": "../vendor/leaflet/dist/leaflet",
    "underscore": "../vendor/underscore/underscore-min"
  }
});

require(["jquery", "jquerymobile", "leaflet", "underscore"], function($, jquerymobile, L, _){
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

      //Gorgeous map: http://jawj.github.io/OverlappingMarkerSpiderfier-Leaflet/demo.html
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
                     + '&hasCoordinate=true'
                     + '&limit=300'
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
                console.dir('Total number of records: ' + json.count);
                records = [];

		getUniqueLocations(json.results);
		
                $.each(json.results, function(index, value){
                    records.push({"type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [getNoise(value.decimalLongitude), getNoise(value.decimalLatitude)]},
                        "properties": {"species": value.species}
                    });
                });
                removeCurrentMarkers();
                geojsonlayer = L.geoJson(records, {
                    onEachFeature: onEachFeature
                }).addTo(map);
            },
            error: function(e) {
                console.log(e.message);
            }
        });
    }

    function removeCurrentMarkers(){
        if (typeof geojsonlayer != "undefined"){
            map.removeLayer(geojsonlayer);
        }
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

    //Work in progress, trying to get list of species grouped by unique lat-lon
    function getUniqueLocations(results){
	//_.uniq(myArray, function(elem) {
	//    return JSON.stringify(_.pick(elem, ['a', 'b']));
	//});

    var aa = [];
    var dd = _.each(results, function(elem){
      return aa.push(_.pick(elem, ['decimalLongitude', 'decimalLatitude']));
    });
    console.dir(aa);
    var bb = _.uniq(aa);
    console.dir(bb);

  	var latlon = _.uniq(results, function(elem) {
//      console.log(_.pick(elem, 'decimalLongitude'));
      var temp = JSON.stringify(_.pick(elem, ['decimalLongitude', 'decimalLatitude']));
      return temp;
  	});
//	console.dir(latlon);	

	//var uniqueLon = _.uniq(_.pluck(json.results, 'decimalLongitude'));
	//		console.dir(uniqueLon);
    }
  });

});
