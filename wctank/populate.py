from wctank import db, models, utils
from flask import json
import pytumblr
import os
import re

pyClient = pytumblr.TumblrRestClient(
    os.environ['WES_TUMBLR_CONSUMER_KEY'],
    os.environ['WES_TUMBLR_CONSUMER_SECRET'],
    os.environ['WES_TUMBLR_OAUTH_TOKEN'],
    os.environ['WES_TUMBLR_OAUTH_SECRET']
)

def updateDb():
    all_posts = []
    offset = 0
    total_posts = 1

    while offset <= total_posts:
        res = pyClient.posts('wctank.tumblr.com', 
                tag='worlds', limit=20, reblog_info=True, offset=offset)
        offset += 20
        total_posts = res['total_posts']
        all_posts += res['posts']

    r = re.compile('-?\d+\.\d+ -?\d+\.\d+')

    for i, post in enumerate(all_posts):
        for tag in post['tags']:
            if r.match(tag):
                tag = tag.split(' ')
                tag = [ float(t) for t in tag ]
                post['lat'] = tag[0]
                post['long'] = tag[1]
                
                json_dump = json.dumps(post)
                hash_id = utils.md5Hexdigest(json_dump)

                if models.Post.query.filter_by(md5=hash_id).first() is None: 
                    db.session.add(models.Post(tag[0], tag[1], json_dump))

    db.session.commit()

