#!/usr/bin/ruby
require 'zip'
require 'csv'

class DarwinCoreArchiveLoader
  def initialize(archive)
    @archive = archive
  end

  def populate(collection)
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

    bad_records = -> (o) { 
      o.values_at('decimalLongitude', 'decimalLatitude', 'taxonKey', 'year', 'datasetKey').any? { |v| v.nil? }
    }

    Zip::File.open(@archive) do |zip_file|
      entry = zip_file.find_entry 'occurrence.txt'
      entry.get_input_stream do |io|
        csv = CSV.new(io, {:headers => true, :col_sep => "\t"})
        csv.lazy.reject(&bad_records).map(&gbif_to_mongo).each_slice(1000) {|r| collection.insert r }
      end
    end
  end
end

