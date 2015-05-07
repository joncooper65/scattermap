require './gbif'
require 'benchmark'

class DatasetDownloader
  def initialize(publisher)
    @publisher = publisher
  end

  def populate(collection)
    gbif = Gbif.new
    # Define the mapping from GBIF representation to the view which we want to
    # insert into the mongo db
    gbif_to_mongo = -> (o) {{
      :loc     => {
        :type => 'Point',
        :coordinates => [o['decimalLongitude'], o['decimalLatitude'] ] },
      :key     => o['taxonKey'],
      :year    => o['year'],
      :dataset => o['datasetKey']
    }}

    datasets = gbif.collection("organization/#{@publisher}/publishedDataset")
    datasets.each do |d|
      records = gbif.collection('occurrence/search', {:datasetKey => d['key']})
      if records.size < 200_000
        # The current dataset can be loaded in, add to mongo in groups of 1000
        puts "Loading dataset #{d['key']} - #{records.size} records"
        time = Benchmark.realtime do
          records.lazy.map(&gbif_to_mongo).each_slice(1000) {|r| collection.insert(r) }
        end
        puts "\t - completed in in #{time}s"
      else
        puts "Too many records in #{d['key']}"
      end
    end
  end
end
