//utils

var Ü = (function(Ü) {
	
	Ü._utils = Ü._utils || {};
	Ü._utils.QSCP = {};
	
	//quadrilateralized spherical cube projection
	Ü._utils.QSCP.forward = function(phi, theta) {
		//TODO: remove Opal layer
    	return Opal.QuadSphere.CSC.$forward(phi, theta);
	};
   	Ü._utils.QSCP.inverse = function(face, x, y) {	
    	//returns [phi, theta]
    	return Opal.QuadSphere.CSC.$inverse(face, x, y);
	};
	
	return Ü;
	
}(Ü || {}));