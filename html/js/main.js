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
    var hasOpenPopups = false;
    var isScientificNames = true;//Show either vernacular (false) names in popup, or else scientific
    var startYear = 1900;//Don't get records before this year
    var totalNumRecords = 0;//Total number of records that are available from gbif for current region - used for paging
    var limit = 300;//Number of records per page
    var offset = limit;//Index of last record from gbif - used for paging
    initialise();

    function initialise(){
      initialiseEvents();
      initialiseMap();
    }

    function initialiseMap(){
      var openStreetMap = 
      L.tileLayer("http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", 
        {
          minZoom: 1, 
          maxZoom: 17, 
          attribution: "Map data copyright <a href='http://openstreetmap.org'>OpenStreetMap</a> contributors"
        });

      map = L.map("map",{
        dragging: true,
        touchZoom: true,
        tap: false,
        inertia: true,
        inertiaDeceleration: 3000,
        inertiaMaxSpeed: 1500,
        tap: true,
        layers: [openStreetMap]
      });
      map.locate({setView: true, zoom: 5});
      map.on("locationfound", onLocationFound);
      map.on("locationerror", onLocationError);
    }

    function initialiseEvents(){
      $('#flip-name').change(function(){
        isScientificNames = $(this).is(':checked');
      });

      //Update the map with the new year after the year slider has been used
      $('#slider-year').parent().mouseup(function(){
        startYear = $('#slider-year').val();
        removeCurrentMarkers();
        addRecords(false);
      });

      //Add more records
      $('#add-more-records').click(function(){
        if(offset >= totalNumRecords){
          $('#no-more-records-popup').popup('open');
        } else {
          offset = offset + limit;
          addRecords(true);
        }
      });
    }

    function onLocationFound(e){
      addRecords(false);

      map.on("movestart", function(e){});

      map.on("move", function(e){});

      map.on("moveend", function(e){
      	addRecords(false);
      });

    }

    function addRecords(isAddMoreRecords){
      if(!hasOpenPopups){
        doLoading();
        var url = getGbifQuery(isAddMoreRecords);
          $.ajax({
              type: 'GET',
              url: url,
              jsonpCallback: 'processtoReturn',
              contentType: "application/json",
              dataType: 'jsonp',
              success: function(json) {
                  totalNumRecords = json.count;
                  if(!isAddMoreRecords){
                    removeCurrentMarkers();
                  }
                  L.geoJson(getGeojson(json.results), {
                      onEachFeature: onEachFeature,
                      pointToLayer: function(feature, latlng){
                        var iconColor = 'blue';
                        if(feature.properties.species.length > 50){
                          iconColor = 'red';
                        }
                        var icon = L.icon({
                                        iconUrl: 'vendor/leaflet/dist/images/marker-icon-' + iconColor + '.png'
                        });
                        return L.marker(latlng, {icon: icon});
                      }
                  }).addTo(map);
                  $.mobile.loading( "hide" );
                  $('#add-more-records').text(moreRecordsText());
              },
              error: function(e) {
                console.log(e.getResponseHeader());
                $.mobile.loading( "hide" );
              }
          });
      }
    }

    function moreRecordsText(){
      if(offset > totalNumRecords){
        return totalNumRecords + ' of ' + totalNumRecords;
      } else {
        return offset + ' of ' + totalNumRecords;
      }
    }


    function doLoading(){
      $.mobile.loading( "show", {
        theme: "b",
        textonly: false,
        html: ""
      });
    }

    /* Returns the GET url for the gbif records
       It only adds a year range if the startYear isn't 1900, otherwise it assumes all records are to be returned - 
       this is because year range queries are quite a bit slower.
    */
    function getGbifQuery(isAddMoreRecords){
      bounds = map.getBounds();
      return  'http://api.gbif.org/v1/occurrence/search?decimalLongitude=' 
                   + bounds.getWest() + ',' + bounds.getEast() + '&'
                   + '&decimalLatitude=' + bounds.getSouth() + ',' + bounds.getNorth()
                   + '&hasCoordinate=true'
                   + ((startYear != 1900) ? '&year=' + startYear + ',' + new Date().getFullYear() : '')
                   + '&limit=' + limit
                   + ((isAddMoreRecords) ? '&offset=' + offset : '')
                   + '&callback=processtoReturn';
    }

    /*
    * Remove the current species markers only if there are no popups open.
    * Note: it seems that the simplest way to detect if a layer on the map 
    * is a species layer is to try to throw an exception by accessing the
    * nested 'species' property.
    */
    function removeCurrentMarkers(){
      offset = limit;
       if(!hasOpenPopups){
         map.eachLayer(function(layer){
          try{
            if(!_.isUndefined(layer.feature.properties.species)){
              map.removeLayer(layer);
            }
          }catch(e){
            //Do nothing, since this was only thrown because the layer does not
            //have the nested 'species' property we were looking for
          }
         });
       }
    }

    function onLocationError(e){
      alert(e.message);
    }

    function handlePopupOpen(event){
      hasOpenPopups = true;
      event.popup.setContent('Getting species...');
      if(isScientificNames){
        event.popup.setContent(getPopupContentScientific(event.target.feature));
      }else{
        populatePopupWithVernacular(event.popup, event.target.feature.properties.species);
      }
    }

    function handlePopupClose(event){
      hasOpenPopups = false;
    }

    function onEachFeature(feature, layer){
      var popup = L.popup({
          maxWidth:200,
          maxHeight: 300,
          autoPan: true,
          keepInView: true
        }, layer);
      layer.bindPopup(popup, {className: 'map-popup'});
      layer.on('popupopen', handlePopupOpen);
      layer.on('popupclose', handlePopupClose);
    }

    /*This takes the raw results from gbif and returns an array of geojson objects.
    * The geojson objects of the array are unique on lat/long and contain the properties required
    * for the placemarker - species list, species keys, latest year a property 
    * that is an array of species names found at that location.
    */
    function getGeojson(results){
      var geojsonResults = {};
      _.each(results, function(gbifSpecies){
        if(gbifSpecies.hasOwnProperty('species')){//Don't do it if this gbif record is not a species (ie might be higher taxon level)
          var geohash = gbifSpecies.decimalLongitude + '' + gbifSpecies.decimalLatitude;
          if(geojsonResults.hasOwnProperty(geohash)){
            updateSpecies(gbifSpecies, geojsonResults[geohash].properties.species);
          }else{
            geojsonResults[geohash] = {
              "type": "Feature",
              "geometry": {"type": "Point", "coordinates": [gbifSpecies.decimalLongitude, gbifSpecies.decimalLatitude]},
              "properties": {"species": []}
            };
            geojsonResults[geohash].properties.species.push(getSpeciesFromGbif(gbifSpecies));
          }
        }
      });
      _.each(geojsonResults, function(elem){
        elem.properties.species = _.sortBy(elem.properties.species,'name');
      });
      var toReturn = [];
      _.map(geojsonResults, function(elem){
        toReturn.push(elem);
      });
      return toReturn;
    }
  });

  function updateSpecies(gbifSpecies, speciesArray){
    var species = _.findWhere(speciesArray, {taxonKey: gbifSpecies.taxonKey})
    if(_.isUndefined(species)){
      speciesArray.push(getSpeciesFromGbif(gbifSpecies));
    }else{
      if(!_.contains(species.datasetKeys, gbifSpecies.datasetKey)){
        species.datasetKeys.push(gbifSpecies.datasetKey);
      }
      if(species.year < gbifSpecies.year){
        species.year = gbifSpecies.year;
      }
    }
  }

  function getSpeciesFromGbif(gbifSpecies){
    var species = {"taxonKey": gbifSpecies.taxonKey, "name": gbifSpecies.species, "year": gbifSpecies.year, "datasetKeys": []};
    species.datasetKeys.push(species.datasetKey);
    return species;
  }

  function populatePopupWithVernacular(popup, speciess){
    var deferreds = [];
    _.each(speciess, function(species){
      deferreds.push(getVernacularName(species.taxonKey));
    });
    $.when.apply($, deferreds).done(function(){
      var vernacularNames = [];
      var scientificNames = [];
      _.each(deferreds, function(deferred){
        if(typeof deferred.responseJSON.vernacularName === "undefined"){
          scientificNames.push('<i>' + firstToUpper(deferred.responseJSON.species) + '</i>');
        }else{
          vernacularNames.push(firstToUpper(deferred.responseJSON.vernacularName));
        }
      });
      vernacularNames.sort();
      scientificNames.sort();
      var content = '';
      _.each(vernacularNames, function(name){
        content = content + name + '<br />';
      });
      if(!_.isEmpty(scientificNames)){
        content = content + '<h4 class="scientific-name-heading">Species without common names:</h4>';
        _.each(scientificNames, function(name){
          content = content + name + '<br />';
        });
      }
      popup.setContent(content);
    });
  }

  function firstToUpper(string){
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  function getVernacularName(taxonKey){
    var url = 'http://api.gbif.org/v1/species/' + taxonKey;
    return $.ajax({
                type: 'GET',
                url: url,
                async: true,
                contentType: "application/json",
                dataType: 'jsonp',
                error: function(e) {
                  $.mobile.loading( "hide" );
                  console.log(e.getResponseHeader());
                },
                statusCode: {
                  503: function(){
                    console.log('gbif service failed to respond');
                  }
                }
    });
  }

  function getPopupContentScientific(feature){
    var popupContent = '<div class="popup-content">';
     if(feature.properties && feature.properties.species){
        _.each(feature.properties.species, function(species){
          popupContent = popupContent + species.name + ' (' + species.year + ')<br \>';
        });
      }
    popupContent = popupContent + '</div>';
    return popupContent;
  }

});
