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
SOURCE_MAP_PATH=./webgl.map
SOURCE_MAP_FROM_TEMPLATE=../webgl.map
EXTERNS_PATH=./devdeps/externs.js

LIB=`find ./lib/*.js`
STATIC=./js/U_static.js
JS=`find ./js/*.js | grep -v ./js/U_static.js`

append_debug_tag ()
{
      echo $'\nAppending source map debug tag...'
      echo //@ sourceMappingURL=${SOURCE_MAP_FROM_TEMPLATE} >> $BUILD_PATH
}

compiling_message ()
{
      echo $'\n' Compiling at $DEV_STATUS status...$'\n\n' $LIB $STATIC $JS $'\n'
}

if [ $DEV_STATUS == DEVO1 ]; then
      compiling_message
      java -jar $COMPILER_PATH --js $LIB $STATIC $JS --js_output_file $BUILD_PATH \
            --language_in ECMASCRIPT5 --create_source_map $SOURCE_MAP_PATH
      append_debug_tag
elif [ $DEV_STATUS == DEVO2 ]; then
      compiling_message
      java -jar $COMPILER_PATH --js $LIB $STATIC $JS --js_output_file $BUILD_PATH \
            --language_in ECMASCRIPT5 --create_source_map $SOURCE_MAP_PATH \
            --compilation_level ADVANCED_OPTIMIZATIONS --externs $EXTERNS_PATH
      append_debug_tag
elif [ $DEV_STATUS == PRODUCTION ]; then
      compiling_message
      java -jar $COMPILER_PATH --js $LIB $STATIC $JS --js_output_file $BUILD_PATH \
            --language_in ECMASCRIPT5 --compilation_level ADVANCED_OPTIMIZATIONS \
            --externs $EXTERNS_PATH
fi

echo $'\nDone.\n'