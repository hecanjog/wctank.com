define(
    [
        'gMap',
        'posts',
        'render',
        'markerMapPosition',
        'markerCore'
    ],

function(gMap, posts, render, markerMapPosition, markerCore) { var markerEvents = {};

    
    // when a marker is added to the map, update data and draw immediately
    var addMarker = function(m) {
        markerMapPosition.push(m);
        markerCore.updateDataAndDraw();
    };
    
    // instantiate markers and post loading!!
    // (...would this be better somewhere else???...)
    gMap.events.push(gMap.events.MAP, 'tilesloaded', function() {
        posts.get(gMap.map.getBounds(), function(data) {
            $.each(data, function(i, post) {
                var m,
                    loc = new google.maps.LatLng(post.lat, post.long);
                m = new google.maps.Marker({
                    position: loc,
                    map: gMap.map,
                    icon: "static/assets/blank.png"
                });
                m.markerType = post.markerType;
                addMarker(m);
                gMap.events.addHeapEvents(gMap.events.MARKER, m);
                google.maps.event.addListener(m, 'click', function() { 
                    posts.display(post); 
                });
            });
        });
    });

    var updateData = false;
    var update = function() {
        if (updateData) {
            markerCore.updateDataAndDraw();
            updateData = false;
        } else {
            markerCore.draw();
        }
    };
    render.push(update);

    gMap.events.push(gMap.events.MAP, 'bounds_changed', function() {
        updateData = true;
    });

return markerEvents; });
// if hash < 1, discard to avoid drawing zeros... for now
