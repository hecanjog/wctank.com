from flask import Flask
from flask import render_template
from flask import json
from flask import jsonify
from flask import Response
import re
import urllib2
from crontab import CronTab
from cron import WctCron

app = Flask(__name__)

# set up database cron job
#sys = CronTab();
#job = sys.new(command='/usr/bin/echo')
#job.hour.every(24)
#job.enable()

wct = WctCron()
wct.populate()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/vimeo_data')
def getVimeoData():
    page = urllib2.urlopen("http://player.vimeo.com/video/64770002")
    vimcdn = re.compile('(http:\/\/pdl\.vimeocdn\.com\/93159\/486\/160286516\.mp4\?token2=.{43})');
    url = vimcdn.findall(page.read())[0]
    return url
    
@app.route('/<swk>/<swa>/<nek>/<nea>')
def getPosts(swk, swa, nek, nea):
    posts = []
    for i in wct.posts: 
        lat = wct.posts[i]['lat']
        lng = wct.posts[i]['long']
        if lat >= float(swk) and lng >= float(swa) and lat <= float(nek) and lng <= float(nea):
            posts += [ wct.posts[i] ]

    return json.dumps(posts)
