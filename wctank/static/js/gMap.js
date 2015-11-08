/**
 * @module gMap
 */


import $ from "jquery";

//////// module private stuff
let events_added = false;

let event_locales = {
    map: {},
    marker: {}
};

class registeredEventCallback {
    constructor(callback, only_once) {
        this.once = only_once;
        this.fn = callback;
    }
}

let addSingleEvent = (event, callback, once, marker) => {
    let locale = marker ? marker : map;
    let add_fn = once ? 
                 google.maps.event.addListenerOnce :
                 google.maps.event.addListener;
    add_fn(locale, event, callback);
};
/////////////////////////////


// on init, holds ref to google.maps.Map obj
export let map = null;
export let overlay = null;

export const events = 
{
    queue: (locale, event, callback, once) => 
    {
        let real_once = once ? once : false;
        if ((events_added && locale === "marker") || !events_added ) {
            if (!event_locales[locale].hasOwnProperty(event)) {
                event_locales[locale][event] = [];
            }
            event_locales[locale][event].push(new registeredEventCallback(callback, real_once));
        } else {
            addSingleEvent(event, callback, real_once);
        }
    },

    // marker here is a ref to an individual marker we might 
    // be attaching events to
    initQueuedEvents: (locale, marker) =>
    {
        // assume the event is attached to the map if the locale is not specified
        let event_set = locale ? event_locales[locale] : event_groups.map;
        let caller = marker ? marker : map; 

        let checked_locale = (() => {
            if (locale === 'map') {
                return map;
            } else if ((locale === 'marker') && marker) {
                return marker;
            } else if (locale === 'marker') {
                throw new Error("Invalid gMap.events.addQueuedEvents param: "+
                    "if locale === 'marker', a target marker object must be provided.");
            }             
        }());

        for (let event_name of Object.keys(event_set)) {
            let always = [];
            let once = [];
            
            for (let callback of event_set[event_name]) {
                let fn = callback.fn;
                callback.once ? once.push(fn) : always.push(fn);
            }

            if (always.length > 0) {
                addSingleEvent(event_name, () => { 
                    for (let fn of always) 
                        fn(caller); 
                }, false, marker);
            }
            if (once.length > 0) {
                addSingleEvent(event_name, () => {
                    for (let fn of once) {
                        fn(caller);
                    } 
                }, true, marker);
            }
        }
        events_added = true; 
    }
};


export function init()
{
    let mapOptions = {
        center: new google.maps.LatLng(43.1, -87.107180),
        zoom: 11,
        mapTypeId: google.maps.MapTypeId.SATELLITE,
        disableDefaultUI: true,
        zoomControl: false,
        zoomControlOptions: {
            position: google.maps.ControlPosition.LEFT_BOTTOM
        }
    };
    map = new google.maps.Map(document.getElementById("map-canvas"), mapOptions);

    overlay = new google.maps.OverlayView();
    overlay.draw = () => {};
    overlay.setMap(map);
}


// mostly for dbug
export function logMapStats()
{
    console.log(map.center.lat()+" "+map.center.lng());
    console.log(map.zoom);
}
window.logMapStats = logMapStats;

// goTo a location/zoom
export function goTo(lat_or_latLng, lng_or_zoom, zoom)
{
    if (('lat' in lat_or_latLng) && ('lng' in lat_or_latLng)) {
        map.setCenter(lat_or_latLng);
        map.setZoom(lng_or_zoom);
    } else {   
        map.setCenter(new google.maps.LatLng(lat_or_latLng, lng_or_zoom));
        map.setZoom(zoom);
    }
}


////////////////////// zoom controls

export function zoomControlsVisible(b)
{
    let $zoomCtl = $(".gmnoprint").not(".gm-style-cc");
    b ? $zoomCtl.show() : $zoomCtl.hide();
}

let zoom_plus = document.getElementById("zoom-in"),
    zoom_minus = document.getElementById("zoom-out");

let randHex = () => {
    return '#'+Math.floor(Math.random()*16777215).toString(16);
};

let plus_last = "#fff";

zoom_plus.addEventListener("click", function() {
    try {
        let z = map.getZoom();
        map.setZoom(++z);
        plus_last = randHex();
        zoom_plus.style.color = plus_last;
    } catch(e) {
        // will throw if map isn't ready, so cover that up.
    }
});

zoom_plus.addEventListener("mouseover", function() {
    zoom_plus.style.color = "#eb054c";
});

zoom_plus.addEventListener("mouseout", function() {
    zoom_plus.style.color = plus_last;
});

let minus_last = "#fff";

zoom_minus.addEventListener("click", function() {
    try {
        let z = map.getZoom();
        map.setZoom(--z);
        minus_last = randHex();
        zoom_minus.style.color = minus_last;
    } catch (e) {}
});

zoom_minus.addEventListener("mouseover", function() {
    zoom_minus.style.color = "#eb054c";
});

zoom_minus.addEventListener("mouseout", function() {
    zoom_minus.style.color = minus_last;
});
