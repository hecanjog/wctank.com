To run tests, you need the following npm packages:

karma    
karma-jasmine    
karma-requirejs    
karma karma-chrome-launcher

I've found the karma-cli handy too (which needs to be installed globally)

Also, if using chromium, you need to set an enviornment variable CHROME_BIN to 
wherever the binary is, e.g., in my .bashrc:

export CHROME_BIN='usr/bin/chromium'

and alias google-chrome to chromium:

alias google-chrome='chromium'
