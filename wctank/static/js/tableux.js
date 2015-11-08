/**
 * @module tableux
 * choose a map center and zoom level depending on what filter is passed to select
 */

import google from "google-maps";

export let flags = {};
flags.ALL = 0xFFFFFFFF;

let bit = 0x40000000;


export function registerEffect(name)
{
    flags[name] = bit;
    bit = bit >>> 1;
}


class TableuxData
{
    constructor(lay, lng, zoom, flag, callbacks) 
    {
        this.loc = new google.maps.LatLng(lat, lng);
        this.zoom = zoom;
        this.flag = flag;
        this.callbacks = callbacks;
    } 
}


let sets = {};


export function pushData(tableuxDataArray)
{
    for (let tdt of tableuxDataArray) {
        for (let name of Object.keys(flags)) {
            if (rudy.util.hasBit(tdt, flags[name])) {
                if (!Array.isArray(sets[name])) sets[name] = [];
                sets[name].push(tdt);
            }   
        }
    } 
}


export function select(effect)
{
    let set = sets[effect.name];
    let idx = (Math.random() * set.length) | 0;
    gMap.goTo(set[idx].loc, set[idx].zoom);
    if (sets[idx].callbacks) {
        for (let cb of sets[idx].callbacks) {
            cb(effect);
        }
    }
}
