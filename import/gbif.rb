require 'json'
require 'open-uri'
require 'cgi'

class Gbif
  def initialize(api='http://api.gbif.org/v1')
    @api = api
  end

  def request(path, query={})
    q_str = query.map{|k,v| "#{CGI::escape(k.to_s)}=#{CGI::escape(v.to_s)}"}.join('&')
    return JSON.load(open("#{@api}/#{path}?#{q_str}"))
  end

  def collection(path, query={}, paging={:offset=>0, :limit=>300})
    page = request(path, query.merge(paging)) # Get the first page so we can set the count
    return Enumerator.new(page['count']) do |y|
      while page['count'] > page['offset']
        page['results'].each { |r| y.yield r }
        paging[:offset] = page['offset'] + page['limit']
        page = request(path, query.merge(paging))
      end
    end
  end
end
