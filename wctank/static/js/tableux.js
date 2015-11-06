/**
 * @module tableux
 * choose a map center and zoom level depending on what filter is passed to select
 */

import {google} from "google-maps";

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


tableux.stockList = [
    // try a different highway one
    new tdt(42.70103069787964, -87.99994131176345, 18, f.CausticGlow),
    // 1/2 404 - try another 404 filled one?
    new tdt(41.73787991072762, -87.47784991638764, 16, f.Cmgyk | f.CausticGlow), 
    // runway 32 
    new tdt(41.351808897930226, -89.22587973528789, 16, f.Vhs | f.CausticGlow | f.PrintAnalog),
    // rows of houses
    new tdt(42.99286263118931, -87.97206972615822, 18, f.PrintAnalog | f.Vhs | f.Fauvist | f.CausticGlow),
    // industrial agriculture - these are nice 
    new tdt(50.677401244851545, -111.73200775079476, 18, f.ALL), 
    new tdt(50.683246001156895, -111.7443836219054, 16, f.CausticGlow),                
];

