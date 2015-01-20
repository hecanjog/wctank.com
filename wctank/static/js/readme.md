Hello, I'm currently working on documentation! However,    
until that's done, it may be handy to know something about    
the module naming scheme to help guide you through the source.  

Closely related modules are always prefixed with an identical    
descriptor, e.g., the 'marker' or 'audio' modules.    

Modules that implement essential functionality for a series of   
interrelated modules are suffixed "-Core", e.g., markerCore.js,     
where the webgl engine to display map markers is implemented.    

Modules that contain a collection of objects that inherit from a   
common parent and are functionally conceptualized in the same way    
are suffixed "-s", e.g., instruments.js, which contains a collection    
of sound makers, all of which use instrumentCore.Instrument as their   
prototype.    

Modules whose primary function is not to provide functionality to       
other modules but need to be included at SOME point are suffixed     
"-Main", e.g., audioUIMain.js, which makes the mute button work.    

Isolated modules are just descriptively named.    
