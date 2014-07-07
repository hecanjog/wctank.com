# This script compiles the contents of ./js and ./lib into ./build;
# change DEV_STATUS to reflect stage of development.
# Possible values:
#     DEVO1      cat, compiler, simple optimizations, create source map, use externs
#     DEVO2      'DEVO1' with ADVANCED_OPTIMIZATIONS
#     PRODUCTION  ADVANCED_OPTIMIZATIONS only 
#
# N.B.! closure compiler requires Java 1.6 or > 

DEV_STATUS=DEVO1

COMPILER_PATH=./devdeps/compiler.jar
BUILD_DIR=./build/
BUILD_PATH=./build/webgl.js
SOURCE_MAP_PATH=./devdeps/map.js
EXTERNS_PATH=./devdeps/externs.js

JS=`find ./lib/*.js`
LIB=`find ./js/*.js`

append_debug_tag ()
{
      echo $'\nAppending source map debug tag...'
      echo //@ sourceMappingURL=${SOURCE_MAP_PATH} >> $BUILD_PATH
}

compiling_message ()
{
      echo $'\n' Compiling at $DEV_STATUS status...$'\n\n' $LIB $JS $'\n'
}

if [ $DEV_STATUS == DEVO1 ]; then
      compiling_message
      java -jar $COMPILER_PATH --js $JS $LIB --js_output_file $BUILD_PATH \
            --language_in ECMASCRIPT5 --create_source_map $SOURCE_MAP_PATH
      append_debug_tag
elif [ $DEV_STATUS == DEVO2 ]; then
      compiling_message
      java -jar $COMPILER_PATH --js $JS $LIB --js_output_file $BUILD_PATH \
            --language_in ECMASCRIPT5 --create_source_map $SOURCE_MAP_PATH \
            --compilation_level ADVANCED_OPTIMIZATIONS --externs $EXTERNS_PATH
      append_debug_tag
elif [ $DEV_STATUS == PRODUCTION ]; then
      compiling_message
      java -jar $COMPILER_PATH --js $JS $LIB --js_output_file $BUILD_PATH \
            --language_in ECMASCRIPT5 --compilation_level ADVANCED_OPTIMIZATIONS \
            --externs $EXTERNS_PATH
fi

echo $'\nDone.\n'