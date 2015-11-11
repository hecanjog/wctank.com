from wctank import db, utils

class Post(db.Model):
    tumblr_id = db.Column(db.BigInteger, primary_key = True)
    lat = db.Column(db.Float)
    lng = db.Column(db.Float)
    json = db.Column(db.Text)

    def __init__(self, tumblr_id, lat, lng, json):
        self.tumblr_id = tumblr_id
        self.lat = lat
        self.lng = lng
        self.json = json
