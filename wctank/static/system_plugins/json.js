/*
  JSON plugin
  from https://github.com/systemjs/plugin-json
*/
exports.translate = function(load) {
  return 'module.exports = ' + load.source;
}
