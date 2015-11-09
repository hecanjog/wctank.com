Installation:
=============
To get a development enviornment running:  

        git clone https://github.com/hecanjog/wctank.com.git  
        python2 setup.py develop

To run a local dev server and bootstrap:

        wct dev
    
    You can also just bootstrap:

        wct bootstrap

    To just run the dev server:

        wct run

To ready the static distributables, cd into the static directory and:
        
        npm install
        npm install -g jspm
        jspm install
        ./builder -p
