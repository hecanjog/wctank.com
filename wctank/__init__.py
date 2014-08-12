from flask import Flask
from flask import render_template
from flask import json
from flask import jsonify
import pytumblr
import re
import os
import sys

app = Flask(__name__)

@app.route('/webgl')
def webgl():
    return render_template('webgl.html')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/<swk>/<swa>/<nek>/<nea>')
def getPosts(swk, swa, nek, nea):

    client = pytumblr.TumblrRestClient(
       os.environ['WES_TUMBLR_CONSUMER_KEY'],
       os.environ['WES_TUMBLR_CONSUMER_SECRET'],
       os.environ['WES_TUMBLR_OAUTH_TOKEN'],
       os.environ['WES_TUMBLR_OAUTH_SECRET']
    )

    all_posts = []
    offset = 0
    total_posts = 1

    while offset <= total_posts:
        res = client.posts('wctank.tumblr.com', tag='worlds', limit=20, reblog_info=True, offset=offset)
        offset += 20
        total_posts = res['total_posts']
        all_posts += res['posts']

    r = re.compile('-?\d+\.\d+ -?\d+\.\d+')

    posts = []

    for i, post in enumerate(all_posts):
        for tag in post['tags']:
            if r.match(tag):
                tag = tag.split(' ')
                tag = [ float(t) for t in tag ]

                # Check to see if post is within bounds
                if tag[0] >= float(swk) and tag[1] >= float(swa) and tag[0] <= float(nek) and tag[1] <= float(nea):
                    # If so, add to posts array
                    post['lat'] = tag[0]
                    post['long'] = tag[1]
                    posts += [ post ]

    return json.dumps(posts)
