#!/usr/bin/ruby
require 'mongo'
require './dataset_downloader'

nbn_datasets = DatasetDownloader.new('07f617d0-c688-11d8-bf62-b8a03c50a862')
conn = Mongo::Connection.new("localhost", 27017)
db = conn['mydb']


records = db['records']    # Create/Get collection to fill
collection.remove()        # Clear out any records in the database
collection.drop_indexes()  # Drop any indexes in this collection
nbn_datasets.populate(records)
collection.create_index :loc => '2dsphere' # Create a spatial index for the layer