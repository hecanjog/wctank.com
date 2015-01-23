// rename to markerMain
define(
    [
        'gMap',
        'posts',
        'render',
        'markerMapPosition',
        'markerCore'
    ],

function(gMap, posts, render, markerMapPosition, markerCore) { var markerEvents = {};


    var updateMarkers = function() {
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
        markerCore.tryDataUpdate();
    };

    gMap.events.queue('map', 'dragend', function() {
        window.setTimeout(updateMarkers, 200);
    });
    gMap.events.queue('map', 'tilesloaded', updateMarkers);
    gMap.events.queue('map', 'zoom_changed', markerCore.forceDataUpdate);

    render.queue(markerCore.draw);

return markerEvents; });
