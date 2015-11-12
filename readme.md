Installation:
=============
To get a development enviornment running, something like:  

        python2 setup.py develop  
        ./wct bootstrap # populate db 
        cd wctank/static          
        npm install
        jspm install
        ./builder -p    # compile static resources
        cd ../../
        ./wct run       # run server

