from wctank import app, db, populate
from scheduler import scheduler

if __name__ == '__main__':
    # doesn't do anything if database already exists
    db.create_all()

    # doesn't overwrite extant posts
    populate.updateDb()

    scheduler.start()

    app.debug = False
    app.run('0.0.0.0')

