from setuptools import setup

setup(
    name='wctank',
    version='1.0',
    description='wctank.com',
    url='http://wctank.com',
    install_requires=[
        'flask', 
        'pytumblr',
    ],
    zip_safe=False,
)