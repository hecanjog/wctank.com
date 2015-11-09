import * as renderLoop from "lib/rudy/renderLoop";
import { PrintAnalog } from "./effects";
import * as gMap from "./gMap";
import * as tableux from "./tableux";

// visuals
let glow = new PrintAnalog();

let flags = tableux.flags;

let stock_list = [
    new tableux.TableuxData(43.00920829994793, -87.90464972035988, 18, flags.PrintAnalog),
];

export function visualSceneStart()
{
    tableux.pushData(stock_list);
    glow.operate(true);
    tableux.select(glow);
}
