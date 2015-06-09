from wctank import db, utils

class Post(db.Model):
    md5 = db.Column(db.String(32), primary_key = True)
    lat = db.Column(db.Float)
    lng = db.Column(db.Float)
    json = db.Column(db.Text)

    def __init__(self, lat, lng, json):
        self.md5 = utils.md5Hexdigest(json)
        self.lat = lat
        self.lng = lng
        self.json = json
