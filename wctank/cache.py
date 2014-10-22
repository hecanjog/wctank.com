import re
import os
import pytumblr
import ZODB, ZODB.FileStorage, BTrees.OOBTree, transaction
from flask import json

pyClient = pytumblr.TumblrRestClient(
    os.environ['WES_TUMBLR_CONSUMER_KEY'],
    os.environ['WES_TUMBLR_CONSUMER_SECRET'],
    os.environ['WES_TUMBLR_OAUTH_TOKEN'],
    os.environ['WES_TUMBLR_OAUTH_SECRET']
)

# basically ripped from the ibm tutorial because it's handy and simple:
# http://www.ibm.com/developerworks/aix/library/au-zodb/
class zodb_utl(object):
    def __init__(self, path):
        self.storage = ZODB.FileStorage.FileStorage(path)
        self.db = ZODB.DB(self.storage)
        self.connection = self.db.open()
        self.root = self.connection.root()
    
    def close_all(self):
        self.connection.close()
        self.db.close()
        self.storage.close()
    
    def close_connection(self):
        self.connection.close()
    
    def open_connection(self):
        self.connection = self.db.open()

class post_cache(): 
    def __init__(self):
        self.instance = {}

    def setup(self):
        db = zodb_utl('./cache.fs')
        db.root.posts = BTrees.OOBTree.BTree()
        transaction.commit()
        db.close_all()
    
    def populate(self):
        db = zodb_utl('./cache.fs')
        self.posts = db.root.posts
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
                    post['json'] = json.dumps(post)
                    db.root.posts[i] = post
        
        transaction.commit()
        db.close_all()
   
    def getposts(self):
        if not self.instance:
            self.instance = zodb_utl('./cache.fs')
        else:
            self.instance.open_connection()
        return self.instance.root.posts
    
    def finish_transaction(self):
        self.instance.close_connection()
