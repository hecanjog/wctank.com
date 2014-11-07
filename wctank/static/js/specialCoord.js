define({
    current: [],
    apply: function(MapFilterObj) {
        console.log(MapFilterObj);
        this.current.push(MapFilterObj);
        MapFilterObj.operate('init');
    },
    rm: function(MapFilterObj) {
        var idx = this.current.indexOf(MapFilterObj);
        if (idx !== -1) this.current.splice(idx, 1);
        MapFilterObj.operate('teardown');
    } 
});
