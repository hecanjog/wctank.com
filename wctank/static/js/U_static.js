/*
 * static env properties - should be the first ./js file loaded!
 */
var Ü = Ü || {}; /*_utils_*/ Ü._ = Ü._ || {};

// first time here?
Ü._.initialLoad = true;

// path to images/video
Ü._.assetPath = "static/webgl_assets/";

// library paths for Parallel requires (relative to static/lib)
Ü._.workerPaths = {
	// eval.js include
	eval: {evalPath: "static/lib/eval.js"},
	jsfeat: 'jsfeat.js'
};


/*
 * This checks the endianness of the host and creates a littleEndian property
 * in _ that should be incorporated into bitwise operations
 * from https://developer.mozilla.org/en-US/docs/Web/API/DataView
 */
Ü._.littleEndian = (function () {
	var buffer = new ArrayBuffer(2);
	new DataView(buffer).setInt16(0, 256, true);
	return new Int16Array(buffer)[0] === 256;
})();

//draw something neat in the console
(function() {/*                                                                                                          
 _             _       _        _                                    _       _           _                
| |           | |     | |      | |                                  | |     | |         | |               
| |_ ___  __ _| |  ___| |_ __ _| |_ _   _  ___  ___   ___  ___ _   _| |_ __ | |_ ___  __| |               
| __/ _ \/ _` | | / __| __/ _` | __| | | |/ _ \/ __| / __|/ __| | | | | '_ \| __/ _ \/ _` |               
| ||  __/ (_| | | \__ \ || (_| | |_| |_| |  __/\__ \ \__ \ (__| |_| | | |_) | ||  __/ (_| |               
 \__\___|\__,_|_| |___/\__\__,_|\__|\__,_|\___||___/ |___/\___|\__,_|_| .__/ \__\___|\__,_|               
                                                                      | |                                 
                                                                      |_|                                 
  __                             _     _                                         _         _   _          
 / _|                           (_)   (_)                                       (_)       | | | |         
| |_ _ __ ___  _ __ ___   __   ___ ___ _  ___  _ __  ___   ___  ___  ___ _ __    _ _ __   | |_| |__   ___ 
|  _| '__/ _ \| '_ ` _ \  \ \ / / / __| |/ _ \| '_ \/ __| / __|/ _ \/ _ \ '_ \  | | '_ \  | __| '_ \ / _ \
| | | | | (_) | | | | | |  \ V /| \__ \ | (_) | | | \__ \ \__ \  __/  __/ | | | | | | | | | |_| | | |  __/
|_| |_|  \___/|_| |_| |_|   \_/ |_|___/_|\___/|_| |_|___/ |___/\___|\___|_| |_| |_|_| |_|  \__|_| |_|\___|
                                                                                                          
                                                                                                          
  __                          _                               __                                          
 / _|                        | |                             / _|                                         
| |_ _ __ ___ _______ _ __   | |_ ___  __ _ _ __ ___    ___ | |_                                          
|  _| '__/ _ \_  / _ \ '_ \  | __/ _ \/ _` | '__/ __|  / _ \|  _|                                         
| | | | | (_) / /  __/ | | | | ||  __/ (_| | |  \__ \ | (_) | |                                           
|_| |_|  \___/___\___|_| |_|  \__\___|\__,_|_|  |___/  \___/|_|                                           
                                                                                                          
                                                                                                          
                       _ _                  _    _                                                        
                      | | |                | |  (_)                                                       
  __ _  ___   ___   __| | |__  _   _  ___  | | ___ ___ ___  ___  ___                                      
 / _` |/ _ \ / _ \ / _` | '_ \| | | |/ _ \ | |/ / / __/ __|/ _ \/ __|                                     
| (_| | (_) | (_) | (_| | |_) | |_| |  __/ |   <| \__ \__ \  __/\__ \                                     
 \__, |\___/ \___/ \__,_|_.__/ \__, |\___| |_|\_\_|___/___/\___||___/                                     
  __/ |                         __/ |                                                                     
 |___/                         |___/                                                                      
*/	
	var mess = $.base64.decode("ICAgICAgICAgICAgICAgCiBfICAgICAgICAgICAgIF8gICAgICAgXyAgICAgICAgXyAgICAgICA"+
"gICAgICAgICAgICAgICAgICAgICAgICAgICAgIF8gICAgICAgXyAgICAgICAgICAgXyAgICAgICAgICAgICAgICAKfCB8ICAgICAgICAgI"+
"CB8IHwgICAgIHwgfCAgICAgIHwgfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IHwgICAgIHwgfCAgICAgICAgIHwgfCA"+
"gICAgICAgICAgICAgIAp8IHxfIF9fXyAgX18gX3wgfCAgX19ffCB8XyBfXyBffCB8XyBfICAgXyAgX19fICBfX18gICBfX18gIF9fXyBfI"+
"CAgX3wgfF8gX18gfCB8XyBfX18gIF9ffCB8ICAgICAgICAgICAgICAgCnwgX18vIF8gXC8gX2AgfCB8IC8gX198IF9fLyBfYCB8IF9ffCB"+
"8IHwgfC8gXyBcLyBfX3wgLyBfX3wvIF9ffCB8IHwgfCB8ICdfIFx8IF9fLyBfIFwvIF9gIHwgICAgICAgICAgICAgICAKfCB8fCAgX18vI"+
"ChffCB8IHwgXF9fIFwgfHwgKF98IHwgfF98IHxffCB8ICBfXy9cX18gXCBcX18gXCAoX198IHxffCB8IHwgfF8pIHwgfHwgIF9fLyAoX3w"+
"gfCAgICAgICAgICAgICAgIAogXF9fXF9fX3xcX18sX3xffCB8X19fL1xfX1xfXyxffFxfX3xcX18sX3xcX19ffHxfX18vIHxfX18vXF9fX"+
"3xcX18sX3xffCAuX18vIFxfX1xfX198XF9fLF98ICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA"+
"gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgI"+
"CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHxffCAgICAgICAgICAgICA"+
"gICAgICAgICAgICAgICAgICAgIAogIF9fICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfICAgICBfICAgICAgICAgICAgICAgICAgI"+
"CAgICAgICAgICAgICAgICAgICAgICBfICAgICAgICAgXyAgIF8gICAgICAgICAgCiAvIF98ICAgICAgICAgICAgICAgICAgICAgICAgICA"+
"gKF8pICAgKF8pICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKF8pICAgICAgIHwgfCB8IHwgICAgICAgICAKfCB8X"+
"yBfIF9fIF9fXyAgXyBfXyBfX18gICBfXyAgIF9fXyBfX18gXyAgX19fICBfIF9fICBfX18gICBfX18gIF9fXyAgX19fIF8gX18gICAgXyB"+
"fIF9fICAgfCB8X3wgfF9fICAgX19fIAp8ICBffCAnX18vIF8gXHwgJ18gYCBfIFwgIFwgXCAvIC8gLyBfX3wgfC8gXyBcfCAnXyBcLyBfX"+
"3wgLyBfX3wvIF8gXC8gXyBcICdfIFwgIHwgfCAnXyBcICB8IF9ffCAnXyBcIC8gXyBcCnwgfCB8IHwgfCAoXykgfCB8IHwgfCB8IHwgIFw"+
"gViAvfCBcX18gXCB8IChfKSB8IHwgfCBcX18gXCBcX18gXCAgX18vICBfXy8gfCB8IHwgfCB8IHwgfCB8IHwgfF98IHwgfCB8ICBfXy8Kf"+
"F98IHxffCAgXF9fXy98X3wgfF98IHxffCAgIFxfLyB8X3xfX18vX3xcX19fL3xffCB8X3xfX18vIHxfX18vXF9fX3xcX19ffF98IHxffCB"+
"8X3xffCB8X3wgIFxfX3xffCB8X3xcX19ffAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI"+
"CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICA"+
"gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI"+
"CAKICBfXyAgICAgICAgICAgICAgICAgICAgICAgICAgXyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfXyAgICAgICAgICAgICA"+
"gICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogLyBffCAgICAgICAgICAgICAgICAgICAgICAgIHwgfCAgICAgICAgICAgICAgICAgI"+
"CAgICAgICAgICAgLyBffCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCnwgfF8gXyBfXyBfX18gX19fX19fXyB"+
"fIF9fICAgfCB8XyBfX18gIF9fIF8gXyBfXyBfX18gICAgX19fIHwgfF8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI"+
"CAgICAKfCAgX3wgJ19fLyBfIFxfICAvIF8gXCAnXyBcICB8IF9fLyBfIFwvIF9gIHwgJ19fLyBfX3wgIC8gXyBcfCAgX3wgICAgICAgICA"+
"gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAp8IHwgfCB8IHwgKF8pIC8gLyAgX18vIHwgfCB8IHwgfHwgIF9fLyAoX3wgfCB8I"+
"CBcX18gXCB8IChfKSB8IHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCnxffCB8X3wgIFxfX18vX19fXF9"+
"fX3xffCB8X3wgIFxfX1xfX198XF9fLF98X3wgIHxfX18vICBcX19fL3xffCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI"+
"CAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA"+
"gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI"+
"CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICA"+
"gICAgICAgXyBfICAgICAgICAgICAgICAgICAgXyAgICBfICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI"+
"CAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgIHwgfCB8ICAgICAgICAgICAgICAgIHwgfCAgKF8pICAgICAgICAgICAgICAgICA"+
"gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogIF9fIF8gIF9fXyAgIF9fXyAgIF9ffCB8IHxfXyAgXyAgIF8gIF9fX"+
"yAgfCB8IF9fXyBfX18gX19fICBfX18gIF9fXyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAvIF9gIHwvIF8gXCA"+
"vIF8gXCAvIF9gIHwgJ18gXHwgfCB8IHwvIF8gXCB8IHwvIC8gLyBfXy8gX198LyBfIFwvIF9ffCAgICAgICAgICAgICAgICAgICAgICAgI"+
"CAgICAgICAgICAgICAKfCAoX3wgfCAoXykgfCAoXykgfCAoX3wgfCB8XykgfCB8X3wgfCAgX18vIHwgICA8fCBcX18gXF9fIFwgIF9fL1x"+
"fXyBcICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogXF9fLCB8XF9fXy8gXF9fXy8gXF9fLF98Xy5fXy8gXF9fLCB8X"+
"F9fX3wgfF98XF9cX3xfX18vX19fL1xfX198fF9fXy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgX18vIHwgICA"+
"gICAgICAgICAgICAgICAgICAgICAgX18vIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI"+
"CAgICAgICAgICAgICAgICAKIHxfX18vICAgICAgICAgICAgICAgICAgICAgICAgIHxfX18vICAgICAgICAgICAgICAgICAgICAgICAgICA"+
"gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI"+
"CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiov");
 
	console.log(mess);

})();