from wctank import db, models, utils
from flask import json
import pytumblr
import logging
import os
import re

_pyClient = pytumblr.TumblrRestClient(
    os.environ['WES_TUMBLR_CONSUMER_KEY'],
    os.environ['WES_TUMBLR_CONSUMER_SECRET'],
    os.environ['WES_TUMBLR_OAUTH_TOKEN'],
    os.environ['WES_TUMBLR_OAUTH_SECRET']
)

_logger = logging.getLogger(__name__)
_logger.setLevel(logging.INFO)
_handler = logging.FileHandler(os.path.expanduser('~/wctank.scheduled_jobs.log'))
_handler.setFormatter(logging.Formatter('%(asctime)s %(message)s'))
_logger.addHandler(_handler)
_logger.addFilter(logging.Filter(name=__name__))

def updateDb():
    all_posts = []
    offset = 0
    total_posts = 1

    while offset <= total_posts:
        res = _pyClient.posts('wctank.tumblr.com', 
                tag='worlds', limit=20, reblog_info=True, offset=offset)
        offset += 20
        total_posts = res['total_posts']
        all_posts += res['posts']

    r = re.compile('-?\d+\.\d+ -?\d+\.\d+')

    for post in all_posts:
        for tag in post['tags']:
            if r.match(tag):
                tag = tag.split(' ')
                tag = [ float(t) for t in tag ]
                post['lat'] = tag[0]
                post['long'] = tag[1]
                
                json_dump = json.dumps(post)
                hash_id = utils.md5Hexdigest(json_dump)

                # don't add to database if hash exists
                if models.Post.query.filter_by(md5=hash_id).first() is None: 
                    db.session.add(models.Post(tag[0], tag[1], json_dump))

    db.session.commit()

    _logger.info('posts db update')
