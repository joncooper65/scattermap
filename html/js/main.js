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

      map.on("movestart", function(e){});

      map.on("move", function(e){});

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

                $.each(getUniqueLocations(json.results), function(index, value){
                    records.push({"type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [value.decimalLongitude, value.decimalLatitude]},
                        "properties": {"species": value.species}
                    });
                });
                // $.each(json.results, function(index, value){
                //     records.push({"type": "Feature",
                //         "geometry": {"type": "Point", "coordinates": [getNoise(value.decimalLongitude), getNoise(value.decimalLatitude)]},
                //         "properties": {"species": value.species}
                //     });
                // });
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
        var popupContent = '';
        _.each(feature.properties.species, function(species){
          popupContent = popupContent + '<br \>' + species;
        });
        layer.bindPopup(popupContent);
      }
    }

    /*This takes the raw results from gbif and reduces to a map of objects.
    * The map's key is unique on latitude and longitude, and is the map of those two values.
    * The map's value is an object containing the latitude, longitude an array of species names found at that location
    */

    function getUniqueLocations(results){

      var picked = [];
      _.each(results, function(elem){
        picked.push(_.pick(elem, ['decimalLongitude', 'decimalLatitude', 'species']));
      });

      _.each(picked, function(elem){
        elem.local = elem.decimalLongitude + '' + elem.decimalLatitude;
      });

      var records = {};
      _.each(picked, function(elem){
        if(records.hasOwnProperty(elem.local)){
          if(!_.contains(records[elem.local].species, elem.species)){
            records[elem.local].species.push(elem.species);
          }
        }else{
          records[elem.local] = {decimalLatitude: elem.decimalLatitude, decimalLongitude: elem.decimalLongitude, species: []};
          records[elem.local].species.push(elem.species);
        }
      });
      return records;
    }

  });

});
