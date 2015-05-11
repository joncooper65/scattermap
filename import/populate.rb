#!/usr/bin/ruby
require 'mongo'
require 'benchmark'
require './dataset_downloader'
require './clusterer'
require './darwincore_loader'

#nbn_datasets = DatasetDownloader.new('07f617d0-c688-11d8-bf62-b8a03c50a862')
nbn_datasets = DarwinCoreArchiveLoader.new('0001117-150504100648427.zip')
conn = Mongo::Connection.new("localhost", 27017)
db = conn['mydb']


records = db['records']    # Create/Get collection to fill
records.remove()           # Clear out any records in the database
#records.drop_indexes()     # Drop any indexes in this collection

puts 'Loading data'
time = Benchmark.realtime { nbn_datasets.populate(records) }
puts "\t - completed in in #{time}s"

# Create a spatial index for the layer
puts 'Creating 2d index'
time = Benchmark.realtime do
  records.create_index :loc => '2dsphere'
end
puts "\t - completed in in #{time}s"

#clusterer = Clusterer.new(records, 20000)
#clusterer.cluster_to(db['clustered'])
