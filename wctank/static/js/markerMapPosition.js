define(
    [
        'util',
        'gMap'
    ],

function(util, gMap) { var markerMapPosition = {};
    // all markers on the map are (lazily) wrapped in a MarkerData object 
    // and appended to markers under a unique hash key
    markerMapPosition.markers = {};
    markerMapPosition.livingKeys = [];
    
    var overflow = 20,
        proj = null;

    var MarkerData = function(googMarker) {
        this.marker = googMarker;
        this.type = googMarker.markerType;
       
        this.worldPosition = googMarker.getPosition();
       
        this.containerPosition;
        this.isAlive;

        this.hash = util.hashCode(this.type + 
            this.worldPosition.lat().toString() + this.worldPosition.lng().toString());

        this.update = function() {
            if (!proj) proj = gMap.pxOverlay.getProjection();
            var pnt = proj.fromLatLngToContainerPixel(this.worldPosition);
            
            this.containerPosition =
                ( pnt.x < -overflow || 
                  pnt.y < -overflow || 
                  pnt.x > window.innerWidth + overflow || 
                  pnt.y > window.innerHeight + overflow ) ? null : pnt;
             
            this.isAlive = this.containerPosition ? true : false;
        };
        this.update();

        this.getDrawingData = function() {
            var DrawingData = function(hash, type, x, y) {
                this.hash = hash;
                this.type = type;
                this.x = x;
                this.y = y;
            };
            return new DrawingData(this.hash, this.type, 
                        this.containerPosition.x, this.containerPosition.y);
        };
    };

    markerMapPosition.push = function(googMarker) {
        var dat = new MarkerData(googMarker);
        markerMapPosition.markers[dat.hash] = dat;
    };

    markerMapPosition.markerExists = function(lat, lng) {
        for (var m in markerMapPosition.markers) {
            if (markerMapPosition.markers.hasOwnProperty(m)) {
                var mark = markerMapPosition.markers[m].worldPosition,
                    err = 0.0000001;
                if (mark.lat() > lat - err && mark.lat() < lat + err &&
                        mark.lng() > lng - err && mark.lng() < lng + err) {
                    return true;
                }            
            }
        }
        return false;
    };

    var r = [];
    
    markerMapPosition.getCurrentState = function() {
        while (r.length > 0) {
            r.pop();
        }
        while (markerMapPosition.livingKeys.length > 0) {
            markerMapPosition.livingKeys.pop();
        }
        
        var markers = markerMapPosition.markers;
        for (var m in markers) {
            if (markers.hasOwnProperty(m)) {
                markers[m].update();
                if (markers[m].isAlive) {
                    r.push(markers[m].getDrawingData());
                    markerMapPosition.livingKeys.push(m);
                }
            }
        }
        return r;
    };

return markerMapPosition; });
