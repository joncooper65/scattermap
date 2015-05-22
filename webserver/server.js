var express = require('express');
var mongo = require('mongodb');
var app = express();

mongo.MongoClient.connect('mongodb://localhost:27017/mydb', function(err, db) {
  db.collection('records', function(err,markers) {
    app.get('/', function (req, res) {

      var bbox = req.query.bbox.split(',');
      var query = {
        "loc":{
          "$geoWithin":{
            "$box":[[bbox[0],bbox[1]],[bbox[2],bbox[3]]]
          }
        }
      };
      markers.find(query, function(err, results) {
        results.toArray(function(err, arr) {
          res.send(arr);
        });
      });
    
    });

    var server = app.listen(80, function () {

      var host = server.address().address;
      var port = server.address().port;

      console.log('Example app listening at http://%s:%s', host, port);
 
    });
  });
});
