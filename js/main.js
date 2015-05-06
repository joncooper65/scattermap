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
    var taxonGroups = ''//Limit to a taxonomic group
    var totalNumRecords = 0;//Total number of records that are available from gbif for current region - used for paging
    var limit = 300;//Number of records per page
    var offset = limit;//Index of last record from gbif - used for paging
    var waitingForRecords = false;//Don't fire any other requests if this is true - helps with map panning
    var boundingBoxOfRecords;//Used to track the bbox of the current set of species records, primarily to refresh the records if the map bounding box is different
    geojsonResults = {};//Data model for current view

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
      //namePreferenceChange
      $('#flip-name').change(function(){
        isScientificNames = $(this).is(':checked');
      });

      //Update the map with the new year after the year slider has been used
      $('#slider-year').parent().mouseup(function(){
        startYear = $('#slider-year').val();
        removeCurrentMarkers();
        addRecords(false);
      });

      //Update taxonomic group change
      $('#taxon-group').change(function(){
        taxonGroups = $('#taxon-group').val();
        removeCurrentMarkers();
        addRecords(false);
      });

      //Handle the 'add more records' click event
      $('#add-more-records').click(function(e){
        if(offset >= totalNumRecords){
          $('#no-more-records-popup').popup('open');
        } else {
          if(!waitingForRecords){
            addRecords(true);
            offset = offset + limit;
          }
        }
      });

      //updateSpeciesInfoPageContent
      $(document).on('pagecontainerbeforetransition', function(e, data){
        if ($.type(data.toPage) !== 'undefined' && $.type(data.absUrl) !== 'undefined' && data.toPage[0].id == 'species-info-page') {
          var params = getParams(data.absUrl);
          addDatasetContent(params.datasetKeys, data);
          addTaxonomyContent(params, data, isScientificNames);
        }
      });

      //Handle geolocation event
      $('#geolocate-button').click(function(){
        map.locate({setView: true, zoom: 5});
      });

    }

    function forcePopupStyle(){
      var background = '#252525';
      $('.leaflet-popup-content-wrapper').css('background-color', background);
      $('.leaflet-popup-tip').css('background', background);
      $('.leaflet-popup-content').css({'border-color': background});
      $('.ui-content .ui-listview, .ui-panel-inner>.ui-listview').css('margin', '0em 0em -1em -1em');
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
                updateGeojsonModel(json.results);
                L.geoJson(getGeojson(geojsonResults), {
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
                   + bounds.getWest() + ',' + bounds.getEast()
                   + '&decimalLatitude=' + bounds.getSouth() + ',' + bounds.getNorth()
                   + '&hasCoordinate=true'
                   + ((startYear != 1900) ? '&year=' + startYear + ',' + new Date().getFullYear() : '')
                   + getTaxonGroupKeys()
                   + '&limit=' + limit
                   + ((isAddMoreRecords) ? '&offset=' + offset : '')
                   + '&callback=processtoReturn';
    }

    /* Returns the taxonGroups value (which may have a single value, csv or be empty) 
       as a query string fragment ready for use in a url
       - where taxonGroups is 123, it returns '&taxonGroup=123'
       - where taxonGroups is 1,2,3 it return '&taxonGroup=1&taxonGroup=2&taxonGroup=3'
       - where taxonGroups is empty it returns and empty string
    */
    function getTaxonGroupKeys(){
      var paramFragment = '&taxonKey=';
      if(_.isNumber(taxonGroups)){
        return paramFragment + taxonGroups;
      } else if(!_.isUndefined(taxonGroups) && !_.isEmpty(taxonGroups)){
        var toReturn = ''
        _.each(taxonGroups.split(','), function(taxonGroup){
          toReturn += paramFragment + taxonGroup;
        });
        return toReturn;
      } else {
        return '';
      }
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
          geojsonResults = {};
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
      event.popup.setContent('<span class="popup-heading">Getting species...</span>');
      if(isScientificNames){
        event.popup.setContent(getPopupContentScientific(event.target.feature));
        $('#index').enhanceWithin();
      }else{
        setPopupContentVernacular(event.popup, event.target.feature.properties.species, forcePopupStyle);
      }
      forcePopupStyle();
    }

    function handlePopupClose(event){
      hasOpenPopups = false;
    }

    function onEachFeature(feature, layer){
      var popup = L.popup({
          maxWidth:250,
          minWidth:200,
          maxHeight: 200,
          autoPan: true,
          keepInView: true
        }, layer);
      layer.bindPopup(popup, {className: 'map-popup'});
      layer.on('popupopen', handlePopupOpen);
      layer.on('popupclose', handlePopupClose);
    }

    /*This takes the raw results from gbif and updates the geojsonResults model with geojson objects.
    * The geojsonResults object uses the hash of the lat/lon to map the geojson objects we are maintaining.
    * So each geojson object is unique on lat/long and contains the properties required
    * for the placemarker - species list, species keys, earliest and latest year a properties.
    */
    function updateGeojsonModel(results){
      //This enforces a lat/lon precision - eg if locationPrecisionLimit=4 then lat/lon gbif values closer than about 11m will be represented by the same point
      var locationPrecisionLimit = 4;
      _.each(results, function(gbifSpecies){
        if(gbifSpecies.hasOwnProperty('species')){//Don't do it if this gbif record is not a species (ie might be higher taxon level)
          //Reduce precision to 4 decimal places, which will cluster locations closer than about 11m
          var geohash = gbifSpecies.decimalLongitude.toFixed(locationPrecisionLimit) + gbifSpecies.decimalLongitude.toFixed(locationPrecisionLimit);
          if(geojsonResults.hasOwnProperty(geohash)){
            updateSpecies(gbifSpecies, geojsonResults[geohash].properties.species);
          }else{
            geojsonResults[geohash] = {
              "type": "Feature",
              "geometry": {"type": "Point", "coordinates": [gbifSpecies.decimalLongitude.toFixed(locationPrecisionLimit), gbifSpecies.decimalLatitude.toFixed(locationPrecisionLimit)]},
              "properties": {"species": []}
            };
            geojsonResults[geohash].properties.species.push(getSpeciesFromGbif(gbifSpecies));
          }
        }
      });
      _.each(geojsonResults, function(elem){
        elem.properties.species = _.sortBy(elem.properties.species,'name');
      });
    }
  });


  /*This returns an array of geojson objects from the geojasonResults model in a form ready for leaflet.
  * The geojson objects of the array are unique on lat/long and contain the properties required
  * for the placemarker - species list, species keys, earlies and latest year a properties.
  */
  function getGeojson(geojsonResults){
    var toReturn = [];
    _.map(geojsonResults, function(elem){
      toReturn.push(elem);
    });
    return toReturn;
  }

  function updateSpecies(gbifSpecies, speciesArray){
    var species = _.findWhere(speciesArray, {taxonKey: gbifSpecies.taxonKey})
    if(_.isUndefined(species)){
      speciesArray.push(getSpeciesFromGbif(gbifSpecies));
    }else{
      if(!_.contains(species.datasetKeys, gbifSpecies.datasetKey)){
        species.datasetKeys.push(gbifSpecies.datasetKey);
      }
      if(species.latestYear < gbifSpecies.year){
        species.latestYear = gbifSpecies.year;
      }
      if(species.earliestYear > gbifSpecies.year){
        species.earliestYear = gbifSpecies.year;
      }
    }
  }

  function getSpeciesFromGbif(gbifSpecies){
    var species = {"taxonKey": gbifSpecies.taxonKey, "name": firstToUpper(gbifSpecies.species), "earliestYear": gbifSpecies.year, "latestYear": gbifSpecies.year, "datasetKeys": []};
    species.datasetKeys.push(gbifSpecies.datasetKey);
    return species;
  }

  function setPopupContentVernacular(popup, speciess, forcePopupStyle){
    var deferreds = [];
    _.each(speciess, function(species){
      deferreds.push(getTaxonomy(species.taxonKey));
    });
    $.when.apply($, deferreds).done(function(){
      var vernacularSpecies = [];
      var scientificSpecies = [];

      //Add the vernacular name to the original species object
      _.each(deferreds, function(deferred){
        _.each(speciess, function(species){
          var isRequiredSpecies = (species.taxonKey == deferred.responseJSON.speciesKey);
          if(isRequiredSpecies){
            if(!_.isUndefined(deferred.responseJSON.vernacularName)){
              species.vernacularName = firstToUpper(deferred.responseJSON.vernacularName);
            }
          }
        });
      });

      //Get a sorted list of species with vernacular names
      vernacularSpecies = 
      _.chain(speciess)
        .filter(function(species){
          return !_.isUndefined(species.vernacularName);
        })
        .sortBy('vernacularName')
        .value();

      //Get a sorted list of species without vernacular names
      scientificSpecies = 
      _.chain(speciess)
        .filter(function(species){
          return _.isUndefined(species.vernacularName);
        })
        .sortBy('name')
        .value();

      //Use the lists of vernacular and scientific species to build the content for the popup
      var content = '<div class="popup-content"><ul data-role="listview">';
      _.each(vernacularSpecies, function(species){
        content += getPopupSpeciesNameLink(species, false);
      });
      if(!_.isEmpty(scientificSpecies)){
        if(!_.isEmpty(vernacularSpecies)){
          content += '<li class="popup-heading"><h4>No common name:</h4></li>';
        }
        _.each(scientificSpecies, function(species){
          content += getPopupSpeciesNameLink(species, false);
        });
      }
      content += '</ul></div>'
      popup.setContent(content);
      $('#index').enhanceWithin();
      forcePopupStyle();
    });
  }

  function getPopupSpeciesNameLink(species, isScientificNames){
    var name = species.name;
    if(!isScientificNames && !_.isUndefined(species.vernacularName)){
      name = species.vernacularName;
    }
    return '<li><a class="popup-link" href="#species-info-page?datasetKeys=' + species.datasetKeys.join(',') + '&taxonKey=' + species.taxonKey + '&earliest=' + species.earliestYear + '&latest=' + species.latestYear + '">' + name + '</a></li>';
  }

  
  /**This ensures that only the first word starts with upper case - all other should start with lower.
  * It does not check that non-first letters are lowercase.
  */
  function firstToUpper(string){
    return string.charAt(0).toUpperCase() + string.toLowerCase().slice(1);
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
    var popupContent = '<div class="popup-content"><ul data-role="listview">';
     if(feature.properties && feature.properties.species){
        _.each(feature.properties.species, function(species){
          popupContent += getPopupSpeciesNameLink(species, true);
        });
      }
    popupContent = popupContent + '</ul></div>';
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

  function addDatasetContent(datasetKeysCSV, data){
    var deferreds = [];
    var datasetContent = '';
    _.each(datasetKeysCSV.split(','), function(datasetKey){
      deferreds.push(getDatasetInfo(datasetKey));
    });
    var datasets = [];
    $.when.apply($, deferreds).done(function(){
      _.each(deferreds, function(deferred){
        var dataset = {"key": deferred.responseJSON.key,
                        "providerKey" : deferred.responseJSON.publishingOrganizationKey,
                        "title": deferred.responseJSON.title,
                        "description": deferred.responseJSON.description,
                        "website": deferred.responseJSON.homepage};
        datasets.push(dataset);
      });
      datasetsSorted = _.sortBy(datasets,'title');
      datasetContent = '<ul data-role="listview" data-inset="true">';
      _.each(datasetsSorted, function(dataset){
        datasetContent += '<li><a href="http://www.gbif.org/dataset/' + dataset.key + '" target="_new"><h2>' + dataset.title + '</h2></a></li>'
      });
      datasetContent += '</ul>'
      $('#dataset-info', data.toPage).html(datasetContent);
      $('#species-info-page').enhanceWithin();
    });
  }

  function addTaxonomyContent(params, data, isScientificNames){
    var deferred = getTaxonomy(params.taxonKey);
    deferred.done(function(){
      var scientificName = deferred.responseJSON.species;
      var vernacularName = deferred.responseJSON.vernacularName;
      var speciesNameTitle = '<i>' + scientificName + '</i>';
      var speciesNameIntro = speciesNameTitle;
      if(!_.isUndefined(vernacularName)){
        speciesNameTitle += ' (' + vernacularName + ')';
      }
      if(!isScientificNames && !_.isUndefined(vernacularName)){
        speciesNameIntro = vernacularName;
      }
      $('#species-name-title', data.toPage).html(speciesNameTitle);
      $('#species-name-intro', data.toPage).html(speciesNameIntro);
      $('#species-info-date', data.toPage).html(getYearText(params));
      $('#species-info-page').enhanceWithin();
    });
  }

  function getYearText(params){
    if(params.earliestYear == params.latestYear){
      return 'Year observed: ' + params.earliest;
    } else {
      return 'Earliest observation: ' + params.earliest + ', latest observation: ' + params.latest;
    }
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
