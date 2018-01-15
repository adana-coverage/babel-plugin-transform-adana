/* global __dirname */

import {readFileSync} from 'fs';
import path from 'path';
import template from '@babel/template';
import astify from 'babel-literal-to-ast';
import meta from './meta';

const render = template(readFileSync(
  path.join(__dirname, '..', 'share', 'prelude.js'), 'utf8'
));

export default function prelude(state) {
  const coverage = meta(state);
  const global = (state.opts && state.opts.global) || '__coverage__';
  return render({
    GLOBAL: astify(global),
    SOURCE: astify(coverage.source),
    VARIABLE: coverage.variable,
    FILE: astify(coverage.name),
    LOCATIONS: astify(coverage.entries),
  });
}
