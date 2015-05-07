class Clusterer
  def initialize(markers, distance)
    @markers = markers
    @distance = distance
  end

  def cluster_to(clustered)
    marker = @markers.find_one
    until marker.nil?
      query = {"loc" => {"$near" => {"$geometry" => marker['loc'], "$maxDistance" => @distance }}}
      species = @markers.find(query).group_by { |d| d['key'] }.map { |t,docs| {
        'key' => t,
        'years' => docs.map{ |d| d['year'] }.uniq,
        'datasets' => docs.map{ |d| d['dataset'] }.uniq
      }}
      clustered.insert([{
        'position' => marker['loc'],
        'species'  => species
      }])

      @markers.remove(query)
      puts "clustered at #{marker['loc']}"
      marker = @markers.find_one
    end
  end
end
