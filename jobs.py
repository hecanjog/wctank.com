from uwsgidecorators import *
from wctank import populate

@cron(0, -1, -1, -1, -1)
def updatePosts(num):
    populate.updateDb()
