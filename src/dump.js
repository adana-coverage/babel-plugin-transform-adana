/* global  */

import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import mkdirp from 'mkdirp';
import lcov from './lcov';

export default function dump({ coverage, path }) {
  const file = join(path, 'lcov.info');
  const file2 = join(path, 'coverage.json');

  if (typeof coverage !== 'undefined') {
    mkdirp.sync(dirname(file));
    writeFileSync(file, lcov(coverage));
  }
  if (typeof coverage !== 'undefined') {
    mkdirp.sync(dirname(file2));
    writeFileSync(file2, JSON.stringify(coverage, null, '  '));
  }
}
