define(
    [
        'util'
        'gMap'
    ],

function(util, gMap) { markerMapPosition = {};
    // all markers on the map are (lazily) wrapped in a MarkerData object 
    // and appended to markers under a unique hash key
    var markers = {};

    function MarkerData(googMarker) {
        this.marker = googMarker;
        this.type = googMarker.markerType;
       
        this.worldPosition = googMarker.getPosition();
       
        this.containerPosition;
        this.isAlive;

        this.hash = util.hashCode(this.type + 
            this.worldPosition.lat().toString() + this.worldPosition.lng().toString());

        this.update = function() {
            var overflow = 20,
                proj = gMap.pxOverlay.getProjection(),
                pnt = proj.fromLatLngToContainerPixel(this.worldPosition);

            this.containerPosition =
                ( (pnt.x < -overflow) || 
                  (pnt.y < -overflow) || 
                  (pnt.x > window.innerWidth + overflow) || 
                  (pnt.y > window.innerHeight + overflow) ) ? 
                null : pnt;
             
            this.isAlive = this.containerPosition ? true : false;
        };
        this.update();

        this.getDrawingData = function() {
            function DrawingData(hash, type, x, y) {
                this.hash = hash;
                this.type = type;
                this.x = x;
                this.y = y;
            }
            return new DrawingData(this.hash, this.type, 
                        this.containerPosition.x, this.containerPosition.y);
        };
    }

    markerMapPosition.push = function(googMarker) {
        var dat = new MarkerData(googMarker);
        if ( !(dat.hash in markers) ) 
            markers[dat.hash] = dat;
    };

    markerMapPosition.getCurrentState = function() {
        var r = [];
        for (var m in markers) {
            if ( markers.hasOwnProperty(m) ) {
                markers[m].update();
                if ( markers[m].isAlive() ) {
                    r.push( markers[m].getDrawingData() );
                }
            }
        }
        return r;
    };

return markerMapPosition; }};
