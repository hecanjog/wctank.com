define(
    
    [
        "jquery"
    ], 
       
function($) { var div = {};
    
    div.$overlay = $('#overlay'),
    div.$map = $("#map-canvas"),
    
    // useful css selectors
    div.selectors = {
        $_map_imgs: "#map-canvas :nth-child(1) :nth-child(1)" + 
            ":nth-child(1) :nth-child(5) :nth-child(1) > div" 
    }

return div; });
