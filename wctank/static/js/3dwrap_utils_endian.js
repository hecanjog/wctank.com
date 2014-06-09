/*
 * This checks the endianness of the host and creates a littleEndian property
 * in _utils that should be incorporated into bitwise operations
 * from https://developer.mozilla.org/en-US/docs/Web/API/DataView
 */

var Ü = (function(Ü) {
	
	Ü._utils = Ü._utils || {};
	
	Ü._utils.littleEndian = (function () {
		var buffer = new ArrayBuffer(2);
		new DataView(buffer).setInt16(0, 256, true);
		return new Int16Array(buffer)[0] === 256;
	})();
	
	return Ü;
	
}(Ü || {}));