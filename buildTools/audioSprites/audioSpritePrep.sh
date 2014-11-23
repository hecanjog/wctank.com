#!/bin/sh

echo $'\n * * *' Parsing audio sprites...$'\n'
praat parseAudioSprite.praat wes wav ./ ../../wctank/static/assets/

echo $' * * *' Converting source file to .mp3...$'\n'
lame wes.wav ../../wctank/static/assets/wes.mp3

echo $'\n * * *' Done.$'\n'
