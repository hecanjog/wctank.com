# FLAGS: 
#     -DEVO1      cat, compiler, simple optimizations, create source map, use externs
#     -DEVO2      'DEVO1' with ADVANCED_OPTIMIZATIONS
#     -PROD       ADVANCED_OPTIMIZATIONS only 
#     Note: compiler requires Java 1.6 or > 

JS=`find ./lib/*.js`
LIB=`find ./js/*.js`

COMPILER_PATH=./devdeps/compiler.jar
BUILD_DIR=./build/
BUILD_PATH=./build/webgl.js
SOURCE_MAP_PATH=./devdeps/map.js
EXTERNS_PATH=./devdeps/externs.js

append_debug_tag ()
{
      echo $'\nAppending source map debug tag...'
      echo //@ sourceMappingURL=${SOURCE_MAP_PATH} >> $BUILD_PATH
}
compiling_message ()
{
      echo $'\nCompiling...\n\n' $LIB $JS $'\n'
}
usage ()
{
      echo "
Usage: build.sh [flag]
Flags:
      -DEVO1 cat, compiler, simple optimizations, make source map, use externs
      -DEVO2 'DEVO1' with ADVANCED_OPTIMIZATIONS
      -PROD  ADVANCED_OPTIMIZATIONS only 
"
}
if [ -z $1 ]; then
      usage
      exit
elif [ $1 == -DEVO1 ]; then
      compiling_message
      java -jar $COMPILER_PATH --js $JS $LIB --js_output_file $BUILD_PATH \
            --language_in ECMASCRIPT5 --create_source_map $SOURCE_MAP_PATH
      append_debug_tag
elif [ $1 == -DEVO2 ]; then
      compiling_message
      java -jar $COMPILER_PATH --js $JS $LIB --js_output_file $BUILD_PATH \
            --language_in ECMASCRIPT5 --create_source_map $SOURCE_MAP_PATH \
            --compilation_level ADVANCED_OPTIMIZATIONS --externs $EXTERNS_PATH
      append_debug_tag
elif [ $1 == -PROD ]; then
      compiling_message
      java -jar $COMPILER_PATH --js $JS $LIB --js_output_file $BUILD_PATH \
            --language_in ECMASCRIPT5 --compilation_level ADVANCED_OPTIMIZATIONS \
            --externs $EXTERNS_PATH
fi

echo $'\nDone.\n'