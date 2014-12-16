from flask import Flask
from flask.ext.sqlalchemy import SQLAlchemy
import urllib2

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///cache.db'
db = SQLAlchemy(app)

import models, populate, controller
