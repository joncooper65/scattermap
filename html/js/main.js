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
      addRecords();

      map.on("movestart", function(e){});

      map.on("move", function(e){});

      map.on("moveend", function(e){
      	addRecords();
      });

    }

    function addRecords(){
        var url = getGbifQuery();
        $.ajax({
            type: 'GET',
            url: url,
            async: false,
            jsonpCallback: 'processtoReturn',
            contentType: "application/json",
            dataType: 'jsonp',
            success: function(json) {
                console.dir('Total number of toReturn: ' + json.count);
                removeCurrentMarkers();
                geojsonlayer = L.geoJson(getGeojson(json.results), {
                    onEachFeature: onEachFeature
                }).addTo(map);
            },
            error: function(e) {
                console.log(e.message);
            }
        });
    }

    function getGbifQuery(){
        bounds = map.getBounds();
        return 'http://api.gbif.org/v1/occurrence/search?decimalLongitude=' 
                     + bounds.getWest() + ',' + bounds.getEast() + '&'
                     + '&decimalLatitude=' + bounds.getSouth() + ',' + bounds.getNorth()
                     + '&hasCoordinate=true'
                     + '&limit=300'
                     + '&callback=processtoReturn';
    }

    function removeCurrentMarkers(){
        if (typeof geojsonlayer != "undefined"){
            map.removeLayer(geojsonlayer);
        }
    }

    function onLocationError(e){
      alert(e.message);
    }

    function onEachFeature(feature, layer){
      //layer.bindPopup(getPopupContentVernacular(feature.properties.taxonkey));
      layer.bindPopup(getPopupContentScientific(feature));
      }
    }

    /*This takes the raw results from gbif and returns an array of geojson objects.
    * The geojson objects of the array are unique on lat/long and each contains a property 
    * that is an array of species names found at that location.
    */
    function getGeojson(results){
      var geojsonResults = {};
      _.each(results, function(elem){
        if(elem.hasOwnProperty('species')){//Don't do it if this gbif record has no species name

          var local = elem.decimalLongitude + '' + elem.decimalLatitude;
          if(geojsonResults.hasOwnProperty(local)){
            if(!_.contains(geojsonResults[local].properties.species, elem.species)){
              geojsonResults[local].properties.species.push(elem.species);
              geojsonResults[local].properties.taxonKey.push(elem.taxonKey);
            }
          }else{

            geojsonResults[local] = {
              "type": "Feature",
              "geometry": {"type": "Point", "coordinates": [elem.decimalLongitude, elem.decimalLatitude]},
              "properties": {"species": [], "taxonKey": []}
            };
            geojsonResults[local].properties.species.push(elem.species);
            geojsonResults[local].properties.taxonKey.push(elem.taxonKey);
          }
        }
      });
      _.each(geojsonResults, function(elem){
        elem.properties.species.sort();
      });
      var toReturn = [];
      _.map(geojsonResults, function(elem){
        toReturn.push(elem);
      });
      return toReturn;
    }
  });

  function getPopupContentVernacular(taxonKeys){
    var popupContent = '<div class="popup-content">';
    _.each(taxonKeys, function(taxonKey){
      popupContent = popupContent + taxonKey + '<br />';
    });
    popupContent = popupContent + '</div>';
    return popupContent;
    // var url = 'http://api.gbif.org/v1/species/' + taxonKey;
    // $.ajax({
    //     type: 'GET',
    //     url: url,
    //     async: false,
    //     contentType: "application/json",
    //     dataType: 'jsonp',
    //     success: function(json) {
    //       popupContent = popupContent + json.vernacularName + '<br \\>';
    //       console.log('hi');
    //       console.log(popupContent);
    //     },
    //     error: function(e) {
    //         console.log(e.message);
    //     }
    // });
  }

  function getPopupContentScientific(feature){
    var popupContent = '<div class="popup-content">';
     if(feature.properties && feature.properties.species){
        _.each(feature.properties.species, function(species){
          popupContent = popupContent + species + '<br \>';
        });
      }
    popupContent = popupContent + '</div>';
    return popupContent;
  }

});
