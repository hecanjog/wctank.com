This is very much still in-progress, and many essential  
features have not yet been implemented.   
TODOs and issues abound!   
   
Support:
========
Currently, only desktop flavors are supported.
Full support for Chrome(ium).
Mostly OK in Firefox.

Installation:
=============
To get a development enviornment running:  

1. clone the repo:  
    
        git clone https://github.com/hecanjog/wctank.com.git  
    
2. Assuming you have pip installed, cd into the directory and
   install the dependencies:   
    
        cd wctank.com  
        sudo pip2 install -r requirements.txt

3. To run a local dev server, you can use the "wct" script in the root directory.

        ./wct dev
    
    This bootstraps the app by creating and populating its database, starts
    the flask runtime, and serves the app with uncompiled js + less.

    To aid deployment, you can also run:

        ./wct bootstrap

    ...which just bootstraps.

    To test whether a build (see /buildtools) was successful, use:

        ./wct run

    ...which skips the bootstrapping and serves compiled sources from wctank/static/dist.

N.B.! 
-----
The app is being deployed with a nginx -> uwsgi stack, which is MUCH more performant then the flask
runtime. In particular, the map markers will take a lot longer to appear than they do in production.
