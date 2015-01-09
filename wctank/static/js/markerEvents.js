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
    gMap.events.push('map', 'tilesloaded', function() {
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
                gMap.events.initQueuedEvents('marker', m);
                google.maps.event.addListener(m, 'click', function() { 
                    posts.display(post); 
                });
            });
        });
    });

    render.push(markerCore.draw);

    gMap.events.push('map', 'bounds_changed', markerCore.updateDataAndDraw);
    gMap.events.push('map', 'tilesloaded', markerCore.updateDataAndDraw);
    gMap.events.push('map', 'zoom_changed', markerCore.forceUpdateDataAndDraw);

return markerEvents; });
// TODO: generate marker data in webworker
// new icons
// then maybe mouseover fanciness
