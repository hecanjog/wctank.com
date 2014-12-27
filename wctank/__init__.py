from flask import Flask
from flask.ext.sqlalchemy import SQLAlchemy
import logging
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///posts.db'
db = SQLAlchemy(app)

log_handler = logging.FileHandler(os.path.expanduser('~/wctank.flask.log'))
log_handler.setLevel(logging.WARNING)
app.logger.addHandler(log_handler)

from wctank import models
from wctank import controller
