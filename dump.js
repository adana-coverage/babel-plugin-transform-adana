/* global require process __coverage__ */
/* eslint no-var: 0 */
// Fucking babel. https://github.com/babel/babel/issues/2212
// Dump that data to disk after tests have finished.
var dump = require('./dist/dump').default;
process.on('exit', function() {
  dump({ coverage: __coverage__, path: 'coverage' });
});
