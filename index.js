/* global module require */
// Fucking babel. https://github.com/babel/babel/issues/2212
/* eslint metalab/import/no-commonjs: 0 */
module.exports = require('./dist/instrumenter').default;
