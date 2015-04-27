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
    var waitingForRecords = false;//Don't fire any other requests if this is true - helps with map panning
    var boundingBoxOfRecords;//Used to track the bbox of the current set of species records, primarily to refresh the records if the map bounding box is different
    
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
      namePreferenceChange();
      yearSliderChange();
      addMoreRecordsClick();
      updateSpeciesInfoPageContent();
    }

    function onLocationFound(e){
      addRecords(false);

      map.on("movestart", function(e){});

      map.on("move", function(e){});

      map.on("moveend", function(e){
        if(!waitingForRecords){
      	 addRecords(false);
        } 
      });
    }

    function addRecords(isAddMoreRecords){
      boundingBoxOfRecords = getBoundsString(map);
      if(!hasOpenPopups){
        doLoading();
        waitingForRecords = true;
        var url = getGbifQuery(isAddMoreRecords);
          $.ajax({
              type: 'GET',
              url: url,
              jsonpCallback: 'processtoReturn',
              contentType: "application/json",
              dataType: 'jsonp',
              success: function(json) {
                waitingForRecords = false;
                totalNumRecords = json.count;
                if(!isAddMoreRecords){
                  removeCurrentMarkers();
                }
                L.geoJson(getGeojson(json.results), {
                    onEachFeature: onEachFeature,
                    pointToLayer: function(feature, latlng){
                      var icon = L.icon({
                                    iconUrl: 'images/marker-icon-green-' + getIconIndex(feature.properties.species.length) + '.png'
                      });
                      return L.marker(latlng, {icon: icon});
                    }
                }).addTo(map);
                $.mobile.loading( "hide" );
                $('#add-more-records').text(moreRecordsText());
              },
              error: function(e) {
                waitingForRecords = false;
                $.mobile.loading( "hide" );
                console.log(e.getResponseHeader());
              },
              complete: function(e){
                if(boundingBoxOfRecords !== getBoundsString(map)){
                  addRecords(false);
                }
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
      var bounds = map.getBounds();
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
        (setPopupContentVernacular(event.popup, event.target.feature.properties.species));
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
    species.datasetKeys.push(gbifSpecies.datasetKey);
    return species;
  }

  function setPopupContentVernacular(popup, speciess){
    var deferreds = [];
    _.each(speciess, function(species){
      deferreds.push(getTaxonomy(species.taxonKey));
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

  function getTaxonomy(taxonKey){
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
          var speciesLink = '<a href="#species-info-page?datasetKeys=' + species.datasetKeys.join(',') + '&taxonKey=' + species.taxonKey + '">' + species.name + '</a>';
          popupContent = popupContent + speciesLink + ' (' + species.year + ')<br \>';
        });
      }
    popupContent = popupContent + '</div>';
    return popupContent;
  }

  function getBoundsString(map){
    var bounds = map.getBounds();
    return '' + bounds.getNorth() + bounds.getSouth() + bounds.getEast() + bounds.getWest();
  }

  function getIconIndex(numSpecies){
    if (numSpecies < 11){
      return 2;
    } else if (numSpecies > 10 && numSpecies < 21){
      return 3;
    } else if (numSpecies > 20 && numSpecies < 31){
      return 4;
    } else {
      return 5;
    }
  }

  function namePreferenceChange(){
    $('#flip-name').change(function(){
      isScientificNames = $(this).is(':checked');
    });
  }

  //Update the map with the new year after the year slider has been used
  function yearSliderChange(){
    $('#slider-year').parent().mouseup(function(){
      startYear = $('#slider-year').val();
      removeCurrentMarkers();
      addRecords(false);
    });
  }

  //Handle the 'add more records' click event
  function  addMoreRecordsClick(){
    $('#add-more-records').click(function(){
      if(offset >= totalNumRecords){
        $('#no-more-records-popup').popup('open');
      } else {
        offset = offset + limit;
        addRecords(true);
      }
    });
  }

  function updateSpeciesInfoPageContent(){
    $(document).on('pagecontainerbeforetransition', function(e, data){
      if ($.type(data.toPage) !== 'undefined' && $.type(data.absUrl) !== 'undefined' && data.toPage[0].id == 'species-info-page') {
        var params = getParams(data.absUrl);
        addDatasetContent(params.datasetKeys, data);
        addTaxonomyContent(params.taxonKey, data);
      }
    });
  }

  function addDatasetContent(datasetKeysCSV, data){
    var deferreds = [];
    var datasetContent = '';
    _.each(datasetKeysCSV.split(','), function(datasetKey){
      deferreds.push(getDatasetInfo(datasetKey));
    });
    var datasets = [];
    $.when.apply($, deferreds).done(function(){
      _.each(deferreds, function(deferred){
        console.log(deferred.responseJSON);
        var dataset = {"datasetKey": deferred.responseJSON.key,
                        "providerKey" : deferred.responseJSON.publishingOrganizationKey,
                        "title": deferred.responseJSON.title,
                        "description": deferred.responseJSON.description,
                        "website": deferred.responseJSON.homepage};
        datasets.push(dataset);
      });
      datasetsSorted = _.sortBy(datasets,'title');
      datasetContent = '<ul data-role="listview" data-inset="true">';
      _.each(datasetsSorted, function(dataset){
        datasetContent += '<li><h2>' + dataset.title + '</h2>' +
                          'Add Organisation' +
                          '<p>' + dataset.description + '</p>' +
                          '<p><a href="' + dataset.website + '">' + dataset.website + '</a></p>' +
                          '</li>'
      });
      datasetContent += '</ul>'
      $('#dataset-info', data.toPage).html(datasetContent);
      $('#species-info-page').enhanceWithin();
    });
  }

  function addTaxonomyContent(taxonKey, data){
    var deferred = getTaxonomy(taxonKey);
    deferred.done(function(){
      var taxonomyContent = '<i>' + deferred.responseJSON.species + '</i>';
      if(!_.isUndefined(deferred.responseJSON.vernacularName)){
        taxonomyContent += ' (' + deferred.responseJSON.vernacularName + ')';
      }
      $('#species-name', data.toPage).html(taxonomyContent);
      $('#species-info-page').enhanceWithin();
    });
  }

  function getDatasetInfo(datasetKey){
    var url = 'http://api.gbif.org/v1/dataset/' + datasetKey;
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

  function getParams(url) {
  return _
    .chain(url.split('?')[1].split('&'))
    .map(function(params) {
      var p = params.split('=');
      return [p[0], decodeURIComponent(p[1])];
    })
    .object()
    .value();
  }

});
