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
    var isScientificNames = true;//Show either vernacular (false) names in popup, or else scientific - only used for those without localStorage
    var startYear = String(1900);//Don't get records before this year
    var taxonGroups = ''//Limit to a taxonomic group
    var totalNumRecords = 0;//Total number of records that are available from gbif for current region - used for paging
    var limit = 300;//Number of records per page
    var offset = limit;//Index of last record from gbif - used for paging
    var waitingForRecords = false;//Don't fire any other requests if this is true - helps with map panning
    var boundingBoxOfRecords;//Used to track the bbox of the current set of species records, primarily to refresh the records if the map bounding box is different
    var yearOfRecords;//Used to track the year filter of the current set of species records, primarily to refresh the records if the slider's year value is diffferent
    var geojsonResults = {};//Data model for current view
    summaryData = {'loadingDatasets': false, 'loadingGroups': false, 'isLoading': function(){return this.loadingDatasets || this.loadingGroups;}}; //Tracks the loading of elements on the summary page for showing/hiding the loader

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

      //Initialise the name preference when it is created - it has a dependency on local storage
      $('#flip-name').flipswitch({
        create: function(event, ui){
          if(getIsScientificNames()){
            $('#flip-name').prop('checked', true).flipswitch('refresh');
           } else {
             $('#flip-name').prop('checked', false).flipswitch('refresh')
           }
        }
      })

      //namePreferenceChange
      $('#flip-name').change(function(){
        setIsScientificNames($(this).is(':checked'));
      });

      //Update the map with the new year after the year slider has been used
      $('#slider-year').parent().touchend(handleYearChange);
      $('#slider-year').parent().keyup(handleYearChange);

      function handleYearChange(){
        startYear = $('#slider-year').val();
        if(startYear.length === 4 && !waitingForRecords){
          removeCurrentMarkers();
          addRecords(false);
        }
      }

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
          addTaxonomyContent(params, data, getIsScientificNames());
        }
      });

      //Handle geolocation event
      $('#geolocate-button').click(function(){
        map.locate({setView: true, zoom: 5});
      });

      //Populate summary page
      $('#summary-button').click(function(){
        generateSummary(geojsonResults, moreRecordsText(totalNumRecords), moreRecordsPercentage(totalNumRecords));
      });

      //Any events when pages load
      $(document).on("pagecontainershow", function(event, ui){
        var pageId = $('body').pagecontainer('getActivePage').prop('id');
        if(pageId == 'summary'){
          if(summaryData.isLoading()){
            $.mobile.loading( "show", {
              textVisible: true,
              text: 'Generating summary'
            });
          }
        }
      });

      $(document.body).on("summarygenerated", function(event){
        $.mobile.loading( "hide");
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
      yearOfRecords = startYear;
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
                $('#add-more-records').text(moreRecordsText(totalNumRecords));
                $('#summary-total-recs').html(totalNumRecords);
              },
              error: function(e) {
                waitingForRecords = false;
                $.mobile.loading( "hide" );
              },
              complete: function(e){
                waitingForRecords = false;
                removeNavBarActive();
                //Refresh records if state of controls has changed since ajax query sent
                if(boundingBoxOfRecords !== getBoundsString(map)){
                  addRecords(false);
                }
                if(yearOfRecords !== $('#slider-year').val()){
                  addRecords(false);
                }
              }
          });
      }
    }

    function moreRecordsText(totalNumRecords){
      if(offset > totalNumRecords){
        return totalNumRecords + ' of ' + totalNumRecords;
      } else {
        return offset + ' of ' + totalNumRecords;
      }
    }

    function moreRecordsPercentage(totalNumRecords){
      if(offset > totalNumRecords){
        return 100;
      } else {
        return Math.round((offset/totalNumRecords) * 100);
      }
    }

    function doLoading(){
      $.mobile.loading( "show", {
        defaults: true
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
    * Remove the current species markers.
    * Note: it seems that the simplest way to detect if a layer on the map 
    * is a species layer is to try to throw an exception by accessing the
    * nested 'species' property.
    */
    function removeCurrentMarkers(){
      offset = limit;
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

    function onLocationError(e){
      alert(e.message);
    }

    function handlePopupOpen(event){
      hasOpenPopups = true;
      event.popup.setContent('<span class="popup-heading">Getting species...</span>');
      if(getIsScientificNames()){
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
      species.numRecs += 1;
    }
  }

  function getSpeciesFromGbif(gbifSpecies){
    var species = {"taxonKey": gbifSpecies.taxonKey, "name": firstToUpper(gbifSpecies.species), "earliestYear": gbifSpecies.year, "latestYear": gbifSpecies.year, "datasetKeys": [], "numRecs": 1};
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

  function getIsScientificNames(){
    if(hasLocalStorage()){
      if(_.isEmpty(localStorage.isScientificNames)){
        localStorage.isScientificNames = true;
      }
      return (localStorage.isScientificNames === 'true');
    } else {
      return isScientificNames;
    }
  }

  function setIsScientificNames(preference){
    if(hasLocalStorage()){
      localStorage.isScientificNames = preference;
    } else {
      isScientificNames = preference;
    }
  }

  function hasLocalStorage(){
      var test = 'test';
      try {
          localStorage.setItem(test, test);
          localStorage.removeItem(test);
          return true;
      } catch(e) {
          return false;
      }
  }

  // Because the nav bar is used for more than navigation, remove the active state from buttons when an action has finished
  function removeNavBarActive(){
    $('.ui-navbar a').removeClass('ui-btn-active');
    $('#index').enhanceWithin();
  }

  function generateSummary(geojsonResults, moreRecordsText, moreRecordsPercentage){
    summaryData.loadingGroups = true;
    summaryData.loadingDatasets = true;
    $('#summary-datasets').empty();
    $('#species-group-summary > tbody').empty();
    $('#top-ten-species > tbody').empty();
    $('#summary-num-markers').html(Object.keys(geojsonResults).length);
    $('#summary-num-recs').html(moreRecordsText);
    $('#summary-percentage-recs').html(moreRecordsPercentage);

    var speciess = new Object();
    var groups = new Object();
    var datasets = [];
    var taxonDeferreds = [];
    var earliestRecord = 3000;
    var latestRecord = 0;
    _.each(geojsonResults, function(location){
      _.each(location.properties.species, function(species){
          if(species.earliestYear < earliestRecord){
            earliestRecord = species.earliestYear;
          }
          if(species.latestYear > latestRecord){
            latestRecord = species.latestYear;
          }
          if(speciess.hasOwnProperty(species.taxonKey)){
            speciess[species.taxonKey].numRecs += 1;
            if(speciess[species.taxonKey].latestYear < species.latestYear){
              speciess[species.taxonKey].latestYear = species.latestYear;
            }
            if(speciess[species.taxonKey].earliestYear > species.earliestYear){
              speciess[species.taxonKey].earliestYear = species.earliestYear;
            }
          } else {
            speciess[species.taxonKey] = {'name': species.name, 'earliestYear': species.earliestYear, 'latestYear': species.latestYear, 'numRecs': species.numRecs};
            taxonDeferreds.push(getTaxonomy(species.taxonKey));
          }
        _.each(species.datasetKeys, function(datasetKey){
          var processedDataset = _.findWhere(datasets, {datasetKey: datasetKey});
          if(_.isUndefined(processedDataset)){
            datasets.push({'key': datasetKey});
          }
        });
      });
    });

    $('#summary-earliest-rec').html(earliestRecord);
    $('#summary-latest-rec').html(latestRecord);
    $('#summary-num-species').html(Object.keys(speciess).length);
    processAndRenderDatasets(datasets, true);
    renderTop10Species(speciess);

    $.when.apply($, taxonDeferreds).done(function(){
      //Add the vernacular name to the original species object
      _.each(taxonDeferreds, function(deferred){
        if(groups.hasOwnProperty(deferred.responseJSON.classKey)) {
          groups[deferred.responseJSON.classKey].numSpecies += 1;
          groups[deferred.responseJSON.classKey].numRecs += speciess[deferred.responseJSON.key].numRecs;
        } else {
          groups[deferred.responseJSON.classKey] = {'key': deferred.responseJSON.classKey, 'kingdomKey': deferred.responseJSON.kingdomKey, 'name': deferred.responseJSON.class, 'numSpecies': 1, 'numRecs': speciess[deferred.responseJSON.key].numRecs};
        }
      });
      var groupArray = [];
      _.each(groups, function(group){
        groupArray.push(group);
      });
      var sortedGroups = _.sortBy(groupArray, function(group){return (-1 * group.numRecs);});
      if(!getIsScientificNames()){
        var vernacularGroups = scientificGroupsToVernacular(sortedGroups);
        var vernacularGroupsArray = [];
        _.each(vernacularGroups, function(group){
          vernacularGroupsArray.push(group);
        });
        sortedGroups = _.sortBy(vernacularGroupsArray, function(group){return (-1 * group.numRecs);});
      }
      addGroupsToPage(sortedGroups);
      summaryData.loadingGroups = false;
      if(!summaryData.isLoading()){
        document.body.dispatchEvent(new CustomEvent('summarygenerated'));
      }
    });
  }

  function renderTop10Species(speciess){
      var speciesArray = [];
      _.each(speciess, function(species){
        speciesArray.push(species);
      });
      var top10Species = _.sortBy(speciesArray, function(species){return (-1 * species.numRecs);}).slice(0,10);
      var title = 'Top 10 species';
      if(top10Species.length < 10){
        title = 'All species';
      }
      $('#summary-species-title').html(title);
      addTop10speciesToPage(top10Species);
  }

  function processAndRenderDatasets(datasets, loadingGroups){
    var datasetDeferreds = [];
    _.each(datasets, function(dataset){
      datasetDeferreds.push(getDatasetInfo(dataset.key));
    });
    $.when.apply($, datasetDeferreds).done(function(){
      _.each(datasetDeferreds, function(deferred){
        _.findWhere(datasets, {key: deferred.responseJSON.key}).title = deferred.responseJSON.title;
      });

      var sortedDatasets = _.chain(datasets)
        .filter(function(dataset){
          return dataset.hasOwnProperty('title');
        })
        .sortBy('title')
        .value();

      var datasetContent = '<ul  class="datasets" data-role="listview" data-inset="true">';
      _.each(sortedDatasets, function(dataset){
        datasetContent += '<li><a href="http://www.gbif.org/dataset/' + dataset.key + '" target="_new">' + dataset.title + '</a></li>'
      });
      datasetContent += '</ul>'
      $('#summary-datasets').html(datasetContent);
      $('#summary-datasets').enhanceWithin();
      summaryData.loadingDatasets = false;
      if(!summaryData.isLoading()){
        document.body.dispatchEvent(new CustomEvent('summarygenerated'));
      }
    });
  }

  var vernacularGroupsData = [{'key': '131','value': 'Amphibians'},
                          {'key': '797','value': 'Butterflies and moths'},
                          {'key': '327,13,9','value': 'Bryophytes'},
                          {'key': '212','value': 'Birds'},
                          {'key': '1470','value': 'Beetles'},
                          {'key': '194','value': 'Conifers'},
                          {'key': '789','value': 'Dragonflies and damselflies'},
                          {'key': '120,121,204,239,357','value': 'Fishes'},
                          {'key': '220','value': 'Flowering plants'},
                          {'key': '5','value': 'Fungi'},
                          {'key': '1458','value': 'Grasshoppers and crickets'},
                          {'key': '216','value': 'Insects'},
                          {'key': '359','value': 'Mammals'},
                          {'key': '52','value': 'Molluscs'},
                          {'key': '715','value': 'Reptiles'},
                          {'key': '1003,1225,787','value': 'River flies'},
                          {'key': '1496','value': 'Spiders'}];

  /*Takes the taxon group summary data in scientific form and converts to our custom vernacular form
  */
  function scientificGroupsToVernacular(scientificGroups){
    var toReturn = {};
    _.each(scientificGroups, function(group){
      var vernacularGroup = getVernacularGroup(group.key);
      //Try the kingdom, since Fungi are grouped at this level
      if(vernacularGroup === null){
        vernacularGroup = getVernacularGroup(group.kingdomKey);
      }
      //default to scientific if no vernacular was found for this group
      if(vernacularGroup === null){
        vernacularGroup = {'key': group.key, 'value': group.name};//, 'numSpecies': group.numSpecies, 'numRecs': group.numRecs};
      }
      if(toReturn.hasOwnProperty(vernacularGroup.key)){
        toReturn[vernacularGroup.key].numSpecies += group.numSpecies;
        toReturn[vernacularGroup.key].numRecs += group.numRecs;
      } else {
        toReturn[vernacularGroup.key] = {'key': vernacularGroup.key, 'name': vernacularGroup.value, 'numSpecies': group.numSpecies, 'numRecs': group.numRecs};
      }
    });
    return toReturn;
  }

  /*This takes a gbif taxon key and returns the matching vernacular group object from our custom list 
    return: our custom vernacular object for this gbif key, or else 
    */
  function getVernacularGroup(testKey){
    var toReturn = null;
    _.each(vernacularGroupsData, function(group){
      _.each(group.key.split(','), function(key){
        if(testKey == key){
          toReturn = group;
        }
      });
    });
    return toReturn;
  }

  function addGroupsToPage(groups){
    var $tableBody = $('#species-group-summary > tbody');
    _.each(groups, function(group){
      $tableBody.append(
        $('<tr>').append(
          $('<td>').text(group.name),
          $('<td>').text(group.numSpecies),
          $('<td>').text(group.numRecs)
          )
      );
    });
    $('#summary').enhanceWithin();
  }

  function addTop10speciesToPage(top10Species){
    var $tableBody = $('#top-ten-species > tbody');
      console.log(getIsScientificNames());
    _.each(top10Species, function(species){
      var name = species.name;
      console.log(species.vernacularName);
      if(!getIsScientificNames()){
        console.log(species);
        name = species.vernacularName;
      }
      $tableBody.append(
        $('<tr>').append(
          $('<td>').text(species.name),
          $('<td>').text(species.numRecs)
          )
      );
    });
    $('#summary').enhanceWithin();
  }

});
