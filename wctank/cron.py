import re
import os
import pytumblr
import ZODB, ZODB.FileStorage, BTrees.OOBTree, transaction

pyClient = pytumblr.TumblrRestClient(
    os.environ['WES_TUMBLR_CONSUMER_KEY'],
    os.environ['WES_TUMBLR_CONSUMER_SECRET'],
    os.environ['WES_TUMBLR_OAUTH_TOKEN'],
    os.environ['WES_TUMBLR_OAUTH_SECRET']
)
fs = ZODB.FileStorage.FileStorage('cache.fs')
db = ZODB.DB(fs)
connection = db.open()
root = connection.root
root.posts = BTrees.OOBTree.BTree()

class WctCron(): 
    def __init__(self):
        self.posts = root.posts
    def populate(self):
        all_posts = []
        offset = 0
        total_posts = 1
    
        while offset <= total_posts:
            res = pyClient.posts('wctank.tumblr.com', tag='worlds', limit=20, reblog_info=True, offset=offset)
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
                    self.posts[i] = post
                    transaction.commit()

