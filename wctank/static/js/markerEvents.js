define(
    [
        'gMap',
        'posts',
        'render',
        'markerMapPosition',
        'markerCore'
    ],

function(gMap, posts, render, markerMapPosition, markerCore) { var markerEvents = {};

    
    // instantiate markers and post loading!!
    // (...would this be better somewhere else???...)
    gMap.events.queue('map', 'tilesloaded', function() {
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
                markerMapPosition.push(m);
                gMap.events.initQueuedEvents('marker', m);
                google.maps.event.addListener(m, 'click', function() { 
                    posts.display(post); 
                });
            });
        });
        markerCore.forceDataUpdate();
    });

    render.push(markerCore.draw);
    
    gMap.events.queue('map', 'zoom_changed', markerCore.forceDataUpdate);

return markerEvents; });
