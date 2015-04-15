~~This is very much in-progress; there's a lot left to do!~~

Well, yeah, but I'm not sure when I'm going to be able to get back to this.    

Here's a todo list that should happen at *some* point:      

1. Address some usability issues. 
  - Start user on newest post, or, at least, on *a* post,             
    and/or ~~on a region on the map that looks like a map~~ (removed the emptier options), with the filtering.                    
  - ~~Don't filter zoom controls.~~ check and check           

2. Fix some of the code slop.          
  - Integrate newer version of rudy api     
   (which contains more high-level organizational structures)               

3. Make better           
  - use more of wes's music.             
  - make audio layer more interactive            
   
Support:
========
Currently, only desktop flavors are supported.   
Full support for recent versions of Chrome(ium), v.37 or better.     
Partial support for older versions of Chrome, as well as newer versions of Opera.     
OK-ish in Firefox.     
Safari does fun things.     

Installation:
=============
To get a development enviornment running:  

1. clone the repo:  
    
        git clone https://github.com/hecanjog/wctank.com.git  
    
2. Assuming you have setuptools installed, cd into the directory and install in develop mode:   
    
        cd wctank.com  
        sudo python2 setup.py develop

3. Then, to run a local dev server:

        wct dev
    
    This bootstraps the app by creating and populating its database, starts
    the flask runtime, and serves the app with uncompiled js + less.

    To aid deployment, you can also run:

        wct bootstrap

    ...which just bootstraps.

    To test whether a build (see /buildtools) was successful, use:

        wct run

    ...which skips the bootstrapping and serves compiled sources from wctank/static/dist.

N.B.! 
-----
The app is being deployed with nginx + uwsgi, which is MUCH more performant then the flask
runtime. In particular, the map markers will take a lot longer to appear than they do in production.
