/*
 * static env properties - should be the first ./js file loaded!
 */
var Ü = Ü || {}; /*_utils_*/ Ü._ = Ü._ || {};
	
// first time here?
Ü._.initialLoad = true;

// path to images & video
Ü._.assetPath = "static/webgl_assets/";

// library paths for Parallel requires (relative to static/lib)
Ü._.workerPaths = {
	// eval.js include
	eval: {evalPath: "static/lib/eval.js"},
	jsfeat: 'jsfeat.js'
};

/*
 * We browser sniff for VERY specific edge cases e.g., Ü._.utils.UEID()
 * this is obviously very fragile and shouldn't be depended on for anything critical
 */
Ü._.agent = (function() {
	var ua = navigator.userAgent.match(/(Mozilla|Chrome|NET|Trident|OPR)/g);
	switch (ua.length) {
		case 1:
			return "Firefox";
		case 2:
			return "Chrome";
		case 3:
			return "IE";
		case 4:
			return "Opera";
	}
}());

/*
 * This checks the endianness of the host and creates a littleEndian property
 * that should be incorporated into bitwise operations
 * from https://developer.mozilla.org/en-US/docs/Web/API/DataView
 */
Ü._.littleEndian = (function () {
	var buffer = new ArrayBuffer(2);
	new DataView(buffer).setInt16(0, 256, true);
	return new Int16Array(buffer)[0] === 256;
}());

//draw something neat in the console
~function() {/*                                                                                                          
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

	var select = Math.random() * 10;

if (select <= 8) {

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

} else {
	
	var mess = $.base64.decode("VlZWVlZWVlZWWE1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTVJSVllZWVlZWVlZWVlZWVlZWVlZCllZWVlWVll"+
"WWVhNTU1NTU1NTU1NTU1NTU1NTVJWWFhSV01NTU1NTU1SVllZWUlJSVlJSVlJSUlZSUlJWQpZWVlZWVlZWVZYTU1NTU1NTU1NTU1NTU1NT"+
"VhZSUlJWXRSTUJNTVJYVllZSUlJSUlJSUlJSUlJSUlJSVkKWVlZWVlZWVlZWE1NTU1NTU1CUkJCTU1NTUJXWSsrK2k7V01NQlJSVllZWUlJ"+
"SUlJSUlJSUlJSUlJSUlJCllZWVlZWVlZVk1NTU1NTUJWVldYV1JCUldXQldJaUlZVlZCTU1SUllJSUlJSUlJSUlJSUlJSUlJSUlJSQpZWVl"+
"ZWVlZWVhNUlhSQkJSSUlJWVhNQk1SVlZXWSt0WUl0Qk1NUlZJSUlJSUlJdEl0SUl0SXR0dElJSUkKWVlZWVlZWVlYTVdXQlhYVnR0SVlZSU"+
"lWSUlJVmksVlJJSVdSUllJSUlJSUl0dHR0dHR0dHR0dHRJdHRJCllZWVlZWVlZUk1SVlJWWUl0dHRJSUkrOiwrWUl0LDtJKyt0WUlJSUlJS"+
"XRJSXR0dHR0dHR0dHR0dHR0SQpZWVlZWVlZVlhNTVhWVlZ0dHRJSUlJaTo6VklJSTouLDouK0lJSUlJSXR0dHR0dHR0dHR0dHR0dHR0dEkK"+
"WVlZWVlZWVlZVk1NVldXdGl0dHRJWUkrVldXV0l0KzouLitJSUlJSUl0dHR0dHR0dHR0dHR0dHR0dHR0CllJSUlJSUlZSVlYUlJXWHRpaXR"+
"JSVlZVlZWVlkrLC47OjtJSUlJSXR0dHR0dHR0dHR0dHR0dHR0dHR0dApJSUlJSUlJSVlZWFhSVlZWdGl0dElZWVZXV1hZdFhpOztZSUlJSX"+
"R0dHR0dHR0dHR0dHR0dHR0dHR0dHQKSUlJSUlJSUlZWFhYWFZZWVl0dElZWVlZVlZYVmk6Ojp0Vll0dHR0dHR0dHR0dHR0dHR0dHR0dHR0d"+
"HR0CklJSUlJSUlJWVlWVlZWWXRWWUlJSUlJWVl0aTs6LCxpWVlJdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dApJSUlJSUlJSUlJSVlWdEl0"+
"WVZYWFZZWUlZWXQrOjtpWXR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHQKSUlJSUlJSUlJSUlZSVl0SUlZWFdCUlhWdGlpKzsrdGl0dGl"+
"pdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0CklJSUlJSUlJSUlZWVZWWUlJSVZYWWkrOzo6LCwsK2k7Ozs7Ojo6K3R0aXR0dHR0dHR0dHR0dH"+
"R0dHR0dApJSUlJSUlJSXRJSVlZWVlJSUlJdHQ7LDo7Oiw6aXQ7LC4sLCwuLi4gK3R0dHR0dHR0dHR0dHR0dHR0dHQKSUlJSUl0dGlpaWlpK"+
"ysrOzs7Ozo6OzosOjosLDosLi4uLiwuLi4uICB0dHR0dHR0dGl0dHR0dHR0dHR0CklJSUl0aTs6OjosLCwsLDo6Ojo6LCwsLCwsLC4uLi4u"+
"Li4uLi4sLi4uaWlpdGlpaWlpdHR0dHR0dHR0dApJaXRpaSs6OiwuLi4uLi4uLCwsLCwsLCwsLCwsLCwsLCwsLi4sLCwsLitpaWlpaXRpaXR"+
"paWl0dHR0dHQKdGlpaSs7OjosLi4uLi4uLiwsLCwsLCwsLCwsLCwsOjo6Ojo6Ojo6LC47aWlpaWlpaWlpaWlpaWlpaWlpCmlpaWkrOzo6Oi"+
"wsLCwsLCw6OjosLCwsLCwsLCwsLDoraXR0dHRpaSsrKysraWl0aWlpaWlpaWlpaWlpdAppaWlpaSs7Ozo7Ojo6Ojo6Ojo6OiwsLCwsLCwuL"+
"DppWVlZWVlZSXRpaWkrKzs7Ojs7K2lpaWlpaWlpaXQKaWlpaSs7Ozs7KytpdCsrKysrKysrKys7Ozs6Oiw7WFhZWVlZWVlZSXR0aWkrKzs6"+
"Ojo6OytpaWlpaWlpCml0aWkrOzs7K2lZSXRpaXR0SXR0aWlpKys7Ozs7OytpdElZWVlZWVlZSUl0aWkrOzs6OisraWlpaWlpaQp0dHRpOzs"+
"7K3RSSXR0dElZSUlJdHRpaWkrOzs7Ozs7Ozs7O2lZVlZWVlZZWVlJdGkrK3RZaWlpSWlpaWkKdEl0dGlpdFlSQll0dHRJSUlJSUl0dHRpKy"+
"srOzs7Ozs7Kys7OytZWFhYWFhWWVlJdHRZWFYrOjtpaWlpCklJSUlZVldSQk1ZdHR0dHR0dElJSXR0dGlpaWlpdFlWVlZWWUl0K2lYV1JSU"+
"lhYVllZWVZYWWkrdHRpaQpJWVZWWFJCQkJNSXR0aWl0dHR0dHR0SXR0dHR0SVhXV1hYWFhWSUl0aVhCQkJCQlJXWFhYWFZJdGk7aWkKWVZY"+
"V1JSQkJNWHRpaWlpaWlpdHR0dEl0dHR0dElWV1hYWFhNV2lpaXR0TU1SVkJNV1hCV1ZZSSt0aWlpCllWV1JCQkJNQnRpdGlpaSsrKytpaXR"+
"0dHR0SUlZVlhYUldYV1dWdCtpaVJNTVJCTVJJaVJYVlZJK2lpaQpWWFJCTU1NTVZpaXRpaSsrKysrK2lpdHR0SUlZWVlWWFdSV1ZWVklJSS"+
"tCTU1CTU1NQlk7SWlpaWkraWkKWFdCTU1CTU1JaWlpdGlpKysrKytpaXR0SVlZWVZWWFhXV1JXWFhWWXQrV0JNTVJXWFdWaStpaSsraStpC"+
"ldCTU1NSVZNUll0aXR0aWlpaWlpaXR0SUlZVlhYV1dXV1JXWFZWSWkrVk1CV1Z0dGlpK2lpaSsrKysrKwpSTU1NUnR0WU1NUlZZSUlJSUlJ"+
"dElJSVlWVlhYV1JCQlJCV1hWSXQrLDorOiwraWlpaWlpaWlpKysrK2kKWFZWVlhWVllSTVJWWUlJWVlWVlZWVlhXV1JSUkJCQkJNQkJSV1l"+
"pLi4uICAgICsrKytpaWlpKysrKytpCklJSUlJWVlZWVlJSUlJSVlZWVZWVklWVlhXUldXV1dYSVhZdDssLi4uLiAgIC4uK2lpK2lpaWkrKy"+
"sraQpJSUlJSUlJdHR0dHR0dHR0dHR0dHRZVlhXUlJCUldYVklpKzs6LC4uICAgICAuLi4rKytpK2krK2lpaWkKSUlJSUlJSUlJSUlJWVlZW"+
"VlZWVZYUkJNTU1CV1ZJSXRpaSs7OiwuLi4gICAgIC4uOysrK2lpKytpaWlpCklZWVlWVlZWVlhYWFdSUlJCQkJCUlJSV1ZWWUlJdHRpaSsr"+
"Ozo6LC4uICAgICAuLiwrKysrKysrK2lpaQpXV1dXV1JSUlhYUkJCUlJXVllJdHR0dHRpdHR0dGlpaWkrKys7OjosLi4gICAgLiwsOysrKys"+
"rKytpaWkKdHR0dHR0dGl0SVhWWXR0aWkrKysraWlpdHR0dHR0dGlpaSsrKzs7OiwuLiAgLi4sLCwrKysrKysraWlpCnR0dHR0dHR0dElJdG"+
"lpKysrKytpaWlpdHRJSUlJSUlJdHRpaSsrOzs6OiwuLi4sOjo6KysraSsrK2lpaQp0dHR0dHR0dGl0aWlpKysrK2lpaXR0dHRJSUlZWUlZW"+
"UlJdHRpaSsrOzs6OiwsOjo7OysrKysrKytpaWkKdHR0dHR0dGlpaSsrKysraWlpdHR0SUlJSVlWVlZWVlZWWUlJdHR0aWkrOzs7Ojo7Oytp"+
"aSsrK2lpaWlpCnR0dHR0dHR0KysrKysrK2lpdHR0dElJWVlZVlZWWFZWVlZWWVlJSXR0aWkrKys7Oys7KysrKytpaWlpaQp0dHR0dHRpKys"+
"rOysraWl0dHRJSUlZWVlZVlZWWFhYWFhYWFZWWVlZSXRpaWkrKzsrOysrK2lpaWlpaWkKdHR0dHR0aSsrKzs7K2l0dFlZWVlZWVlZWVZWVl"+
"ZYWFdXV1hYWFZWWVlZdGlpaSs7OmlpaWlpaWlpaWlpCnR0dHR0dGkrKysrKytpaXRJSVlWVlZWVlZWWFZYWFhXV1dXV1dYWFZWWUl0dGlpK"+
"ytpaWlpaWlpaWlpaQp0dHR0dGlpaSsrKytpaWl0dElZWVZYV1dXWFdYWFhYWFdXV1JSUldYWFZZSXRpKytpaWlpaWlpaWlpaWkKdHR0dHR0"+
"aWkrKytpaWlpdHR0SUlJWVZXUkJSUlJXV1dXV1dSUlJSUldYVllJdGlpaWlpaWlpaWlpaWlpCnR0dHR0aWlpaWlpaWlpaXR0dElJSUlJSVZ"+
"STU1CQlJXV1dXV1JCQkJSV1hWaWlpaWlpaWlpaWlpaWlpaQp0dHR0dGlpaWlpaWlpaWlpdHR0dHR0dGlpSVdCTU1CUlJXV1JSUkJCUldJaW"+
"lpaWlpaWlpaWlpaWlpaWkKdHR0dHRpdGlpaWlpaWlpaWl0dHR0aSs7OjsrSVJNTUJCQkJCQlJSVnRpaWlpaWlpaWlpaWlpaWlpaWlpCnR0d"+
"HR0dHR0dGlpaWlpaXR0dHR0dGkrOzo6OjorWVJSQkJCUlJWK2lpaWlpaWlpaWlpaWlpaWlpaWlpaQp0dHR0dHR0dHR0dHRpaXR0dHR0dHRp"+
"Kzs7OjosOjppQkJNTU1XOyxpaWlpaWlpaWlpaWlpaWlpaWlpaWkKdHR0dHRpSUl0dHR0dHR0dHR0dEl0dGkrOzo6Oiw6OllNTU1YKzo6K2l"+
"paWlpaWlpaWlpaWlpaWlpaWlpCnR0dHR0dElJdHR0dHR0dHR0dElJSXR0aSs7Ozo6LDo6UldJOzo6Ojp0aWlpaWlpaWlpaWlpaWl0aWlpaQ"+
"p0dHR0dHR0SUl0dHR0dHR0dHRJSUlJdHRpKzs6Ojo6OisrOzs7Ojo6aWlpaWlpaWlpaWlpaWl0dGlpaWkKdHR0dHR0dElJSXR0dHR0dElJS"+
"UlJSXR0aSsrOzo6Ojo7Kys7Ozs7OytpaWlpaWlpaWlpaWlpaXRpaWlpCnR0dHR0dHR0SUlJdHRJdHRJSUlJSUlJdHRpKzs7Ojo6O2krKzs7"+
"OzsrdHRpaWlpaWlpaWlpaXR0aWlpaQp0dHR0dHR0dHRJSUlJSUlJSUlJSVlZSUl0aWkrOzs7OzsrKysrKzs7K2l0dGlpaWlpaWlpaWlpdHR"+
"paWkKdHR0dHR0dHR0dElJSUlJSUlJSUlZWVlJSXR0aSs7Ozs7aWkrKys7Ozt0aXRpdHRpaWlpaWlpdHR0aWl0CnR0dHR0dHR0dHR0WUlJSU"+
"lJSUlZWVlZWUlJSXRpKzs7O2lpaWkrKzs7aWlpaXRpdGlpaWl0dHR0dGlpdAp0dHR0dHR0dHR0dElJSUlJSUlJSVlZWVlZWUl0dGkrOytpd"+
"GlpKys7O2lpdGlpdGlpaWlpaWlpaWlpdHQKdHR0dHR0dHR0dHR0SUlJSUlJSUlJWVZWWVlJSXRpKys7aXR0aSsrOztpaXRpdHRpaWlpdGlp"+
"aWlpaWl0CnR0dHR0dHR0dHR0dElJSUlJSUlJSVlZVlZZWUl0dCsrK2lJdGlpKys7aXR0dHR0dHRpdGlpaWlpaWlpdA==");

}

	console.log(mess);

}();