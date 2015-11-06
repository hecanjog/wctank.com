from wctank import app, models
from flask import render_template, request, send_file, Response, redirect, url_for
import urllib2
import mimetypes
import os
import re

# flip to true to use raw sources
dev_template = False

@app.route('/')
def index():
    return render_template('index.html', dev_template=dev_template)

# feature detection fatal
@app.route('/feature-fail/<failure_type>')
def featureFail(failure_type):
    return render_template('fail.html', type=failure_type, dev_template=dev_template);

# used when grabbing raw video for webgl processing
@app.route('/vimeo_data')
def getvimeodata():
    page = urllib2.urlopen("http://player.vimeo.com/video/64770002")
    vimcdn = re.compile('(http:\/\/pdl\.vimeocdn\.com\/93159\/486\/160286516\.mp4\?token2=.{43})');
    url = vimcdn.findall(page.read())[0]
    return url
 
# query database for posts within visible bounds
@app.route('/posts/<swk>/<swa>/<nek>/<nea>')
def getposts(swk, swa, nek, nea):
    records = models.Post.query.filter(models.Post.lat >= swk) \
        .filter(models.Post.lng >= swa) \
        .filter(models.Post.lat <= nek) \
        .filter(models.Post.lng <= nea).all()
    
    posts = []
    for i in records:
        posts.append(i.json)

    return ' '.join(['[', ','.join(posts), ']'])

@app.after_request
def after_request(response):
    response.headers.add('Accept-Ranges', 'bytes')
    response.cache_control.max_age = 0
    response.cache_control.public = True
    return response

# mostly some copypasto from: 
# http://blog.asgaard.co.uk/2012/08/03/http-206-partial-content-for-flask-python
# to support HTTP 206
@app.route('/streaming/<fileName>')
def send_file_partial(fileName):
    path = os.path.expanduser("~/wctank.com/wctank/static/assets/" + fileName)

    range_header = request.headers.get('Range', None)
    if not range_header:
        return send_file(path)

    size = os.path.getsize(path)
    byte1, byte = 0, None

    m = re.search('(\d+)-(\d*)', range_header)
    g = m.groups()

    if g[0]:
        byte1 = int(g[0])
    if g[1]:
        byte2 = int(g[1])

    length = size - byte1
    if byte is not None:
        length = byte2 - byte1

    data = None
    with open(path, 'rb') as f:
        f.seek(byte1)
        data = f.read(length)

    rv = Response(data,
        206,
        mimetype=mimetypes.guess_type(path)[0],
        direct_passthrough=True)
    rv.headers.add('Content-Range', 'bytes {0}-{1}/{2}'.format(byte1, byte1 + length - 1, size))

    return rv
