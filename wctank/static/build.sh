echo COMPILING...
JS=`find ./lib/*.js`
LIB=`find ./js/*.js`
echo $JS
echo $LIB
java -jar ./devdeps/compiler.jar --js $JS $LIB --js_output_file ./build/webgl.js \
      --language_in ECMASCRIPT5 \
      #--compilation_level ADVANCED_OPTIMIZATIONS --externs ./devdeps/externs.js --create_source_map ./devdeps/map.js
echo Done.
#echo APPENDING DEBUGTAG
#echo '//@ sourceMappingURL=../devdeps/map.js' >> ./build/webgl.js
#echo Done.