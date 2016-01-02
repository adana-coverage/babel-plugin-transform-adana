/* global __dirname */

import { readFileSync } from 'fs';
import path from 'path';
import template from 'babel-template';
import astify from 'babel-literal-to-ast';
import meta from './meta';

const render = template(readFileSync(
  path.join(__dirname, '..', 'share', 'prelude.js'), 'utf8'
));

export default function prelude(state) {
  const coverage = meta(state);
  //  ||
  const name = state.file.opts.filenameRelative;
  return render({
    HASH: astify(coverage.hash),
    TAGS: astify(coverage.tags),
    VARIABLE: coverage.variable,
    FILE: astify(name),
    LOCATIONS: astify(coverage.entries),
    COUNT: astify(coverage.entries.length),
  });
}
