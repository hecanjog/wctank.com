from setuptools import setup

setup(
    name='wctank',
    version='1.0',
    description='wctank.com',
    url='http://wctank.com',
    install_requires=[
        'Flask', 
        'pytumblr',
        'Flask-SQLAlchemy',
        'docopt',
    ],
    scripts=['wct'],
    zip_safe=False,
)
