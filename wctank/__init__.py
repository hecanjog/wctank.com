from flask import Flask
from flask.ext.sqlalchemy import SQLAlchemy
import logging
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///cache.db'
db = SQLAlchemy(app)

log_handler = logging.FileHandler(os.path.expanduser('~/wctank.flask.log'))
log_handler.setLevel(logging.WARNING)
app.logger.addHandler(log_handler)

import models, populate, controller
