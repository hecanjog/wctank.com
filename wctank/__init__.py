from flask import Flask
from flask import render_template
import re
import urllib2
from cache import post_cache

app = Flask(__name__)

# create and fill cache
cache = post_cache()
print(' * Initializing database...')
cache.setup()
print(' * Populating database...')
cache.populate()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/vimeo_data')
def getvimeodata():
    page = urllib2.urlopen("http://player.vimeo.com/video/64770002")
    vimcdn = re.compile('(http:\/\/pdl\.vimeocdn\.com\/93159\/486\/160286516\.mp4\?token2=.{43})');
    url = vimcdn.findall(page.read())[0]
    return url
    
@app.route('/<swk>/<swa>/<nek>/<nea>')
def getposts(swk, swa, nek, nea):
    all_posts = cache.getposts()
    posts = []
    for i in all_posts: 
        lat = all_posts[i]['lat']
        lng = all_posts[i]['long']
        if lat >= float(swk) and lng >= float(swa) and lat <= float(nek) and lng <= float(nea):
            posts.append(all_posts[i]['json'])
    #cache.finish_transaction()
    return ' '.join(['[', ','.join(posts), ']'])
