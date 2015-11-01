/* global process __coverage__ */

import { writeFileSync } from 'fs';
import { dirname } from 'path';
import mkdirp from 'mkdirp';
import lcov from './lcov';

const file = 'coverage/lcov.info';
const file2 = 'coverage/coverage.json';

// Dump that data to disk after tests have finished.
process.on('exit', () => {
  if (typeof __coverage__ !== 'undefined') {
    mkdirp.sync(dirname(file));
    writeFileSync(file, lcov(__coverage__));
  }
  if (typeof __coverage__ !== 'undefined') {
    mkdirp.sync(dirname(file2));
    writeFileSync(file2, JSON.stringify(__coverage__, null, '  '));
  }
});
