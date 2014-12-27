from wctank import populate
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler(timezone="UTC")
scheduler.add_executor('processpool')
scheduler.add_jobstore('sqlalchemy', url='sqlite:///wctank/jobs.db')

ids = [x.id for x in scheduler.get_jobs()]

def firstPopulate():
    populate.updateDb()

if 'updatePostsDb' not in ids:
    scheduler.add_job(populate.updateDb, 'interval', hours=1, id='updatePostsDb')
