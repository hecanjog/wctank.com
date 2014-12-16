from wctank import app, db, models
from flask import render_template
import urllib2
import re

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
    records = models.Post.query.filter(models.Post.lat >= swk) \
        .filter(models.Post.lng >= swa) \
        .filter(models.Post.lat <= nek) \
        .filter(models.Post.lng <= nea).all()
    
    posts = []
    for i in records:
        posts.append(i.json)
    
    print posts

    return ' '.join(['[', ','.join(posts), ']'])
