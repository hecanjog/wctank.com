Hello, I'm currently working on documentation! However, until that's done, it   
may be handy to know something about the module naming scheme to help guide    
you through the source.     

Closely related modules are always prefixed with an identical descriptor, e.g.,    
the 'marker' or 'audio' modules.      
  
Modules that implement essential functionality for a series of interrelated    
modules are suffixed "-Core", e.g., markerCore.js, where the engine that   
displays map markers is implemented.    
  
Modules that contain a collection of objects that are used in the same way and   
*may* inherit from a common parent are suffixed "-s", e.g., audioModules.js,    
which contains a collection of components used to assemble instruments, all of   
which inherit audioCore.AudioModule as their protptype.

Modules whose primary function is not to provide functionality to other modules    
but need to be included at SOME point are suffixed "-Main", e.g., audioUIMain.js,    
which makes the mute button work.      

Isolated modules are just descriptively named.      
