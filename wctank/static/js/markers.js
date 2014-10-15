wctank = wctank || {};

/*
 * markers creates a canvas overlay so that the pins are
 * not modified by svg filters applied to the map
 */
wctank.markers = (function(markers) {
    wctank.aliasNamespace.call(markers.prototype);
    
    var overlay;
    var disp = (function(disp) {
        var CanvPrep = function(canv_elem) {
            this.canv = canv_elem;
            this.ctx = this.canv.getContext("2d");
        };
        var getImageCanv = function(path) {
            var img = new Image();
            img.src = path;
            var can = document.createElement("canvas");
            img.onload = function() {
                can.width = img.width;
                can.height = img.height;
                ctx = can.getContext("2d");
                ctx.drawImage(img, 0, 0); 
            };
            return can;
        };
        var c = {
            0: new CanvPrep( document.getElementById("markers-a") ),
            1: new CanvPrep( document.getElementById("markers-b") ),
            y: 0
        };
        (function resizeC() {
            c[0].canv.width = c[1].canv.width = window.innerWidth;
            c[0].canv.height = c[1].canv.height = window.innerHeight;
             window.addEventListener('resize', function() {
                resizeC();
            });
        }())
        var imgs = {
            video: getImageCanv('static/assets/colorbars.png'),
            stumble: getImageCanv('static/assets/rap.png'),
            random: getImageCanv('static/assets/rand.png')
        };
        var px_$ = [];
        disp.drawCycle = function(px_arr) {
            if (px_arr) {  
                if (px_$.length > 0) {
                    for (var i = 0; i < px_$.length; i++) {
                        var x = px_$[i][1].x;
                        var y = px_$[i][1].y;
                        c[c.y].ctx.clearRect(x, y, x + 80, y + 80);
                    }
                }
                c.y = (c.y + 1) % 2;
                for (var i = 0; i < px_arr.length; i++) {
                    var px = px_arr[i][1];
                    var img = imgs[ px_arr[i][0] ];
                    c[c.y].ctx.drawImage(img, px.x, px.y);
                }
                px_$ = px_arr;
            }
        };
        return disp;
    }({}))          
    var marks = (function(marks) {
        var stk = [];
        var lats = [];
        var lngs = [];
        var overflow = 20;
        marks.isDuplicate = function(m) {
            var pos = m.getPosition();
            var lat_idx =  lats.indexOf( pos.lat() );
            if ( lat_idx !== -1 ) {
                var lng_idx = lngs.indexOf( pos.lng() );
                if ( lng_idx !== -1 ) {
                    if (lat_idx === lng_idx) return lat_idx;
                }
            }
            return false;
        };
        marks.pushMark = function(m) {
            var pos = m.getPosition();
            stk.push(m);
            lats.push( pos.lat() );
            lngs.push( pos.lng() );
        };      
        marks.rmMark = function(m) {
            var idx = marks.isDuplicate(m);
            if (idx) {
                stk.splice(idx, 1);
                lats.splice(idx, 1);
                lngs.splice(idx, 1);
            }
        };
        var getMarkXY = function(m, pjkt) { 
            var pos = m.getPosition();
            var px = pjkt.fromLatLngToContainerPixel(pos); 
            for (var dim in px) {
                if (px.hasOwnProperty(dim) ) {
                    if ( px[dim] < (overflow * -1) ) return false;
                }
            }
            px.x -= 27;
            px.y -= 35;
            return px;
        };
        marks.getDrawingInfo = function() {
            if (stk.length > 0) {   
                var r = [];
                var pjkt = overlay.getProjection();
                for (var i = 0; i < stk.length; i++) {
                    var px = getMarkXY(stk[i], pjkt);
                    if (px) r.push([stk[i].markerType, px]);   
                }
                return r;
            }
        };  
        return marks;
    }({}))
    var update = function() {
        disp.drawCycle( marks.getDrawingInfo() );
    };
    markers.setOverlay = function(g_ovr_obj) {
        overlay = g_ovr_obj;
    };
    markers.addMarker = function(m) {
        if ( !marks.isDuplicate(m) ) {
            marks.pushMark(m);
            update();         
        }
    };
    gMap.events.push(gMap.events.MAP, 'bounds_changed', update);
     
   return markers;
}({}))
