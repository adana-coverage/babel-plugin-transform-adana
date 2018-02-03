# babel-plugin-transform-adana

Minimal, complete code-coverage tool for [babel] 6+.

![build status](http://img.shields.io/travis/adana-coverage/babel-plugin-transform-adana/master.svg?style=flat)
![coverage](http://img.shields.io/coveralls/adana-coverage/babel-plugin-transform-adana/master.svg?style=flat)
![license](http://img.shields.io/npm/l/babel-plugin-transform-adana.svg?style=flat)
![version](http://img.shields.io/npm/v/babel-plugin-transform-adana.svg?style=flat)
![downloads](http://img.shields.io/npm/dm/babel-plugin-transform-adana.svg?style=flat)

Has all the features (and more) of [istanbul] including line, function and branch coverage, but works as a [babel] plugin instead of relying on `esparse` and `escodegen`. Works great with [west], [mocha], [jasmine] and probably more.

Features:

 * First-class babel support,
 * Per-line/function/branch coverage,
 * Tagged instrumentation,
 * User-defined tags,
 * Smart branch detection.

## Usage

Install `babel-plugin-transform-adana`:

```sh
npm install --save-dev babel-plugin-transform-adana
```

Setup your `.babelrc` to use it:

```json
{
  "env": {
    "test": {
      "plugins": [[
        "transform-adana", {
          "ignore": "test/**/*"
        }
      ]]
    }
  }
}
```

**IMPORTANT**: This plugin works best when it runs as the _first_ plugin in the babel transform list, since its purpose is to instrument your _original code_, not whatever other transformations happen to get made.

**NOTE**: This plugin is only responsible for _instrumenting_ your code, not verifying the coverage information or reporting. You can install something like `adana-cli` to get something like `istanbul check-coverage`. See the [adana-cli] repository for more information.

### mocha

Usage with [mocha] is straight-forward. The only thing you need to do after running your code is dump the coverage information to disk so it can be processed; [mocha] can do this via its `-r` flag.

Install the necessary packages:

```sh
npm install --save-dev \
  mocha \
  adana-cli \
  adana-dump \
  adana-format-lcov \
  babel-plugin-transform-adana
```

Start testing with mocha:

```sh
#!/bin/sh

# Run tests and dump the coverage information.
NODE_ENV="test" mocha \
  -r adana-dump \
  -r @babel/register \
  test/*.spec.js

# Upload coverage data to coveralls.
cat ./coverage/coverage.json \
  | ./node_modules/.bin/adana --format lcov \
  | ./node_modules/coveralls/bin/coveralls.js
```

### jasmine

Usage with [jasmine] is less straight-forward than with [mocha] since there is no native babel support. The package [jasmine-es6] can be used to use [babel] (and therefore adana) with [jasmine].

Install the necessary packages:

```sh
npm install --save-dev \
  jasmine-es6 \
  adana-cli \
  adana-dump \
  adana-format-lcov \
  babel-plugin-transform-adana
```

Add the output tool as a helper to jasmine via `jasmine.json` in order to ensure your coverage data gets output:

```json
{
  "spec_dir": "spec",
  "spec_files": [
    "**/*[sS]pec.js"
  ],
  "helpers": [
    "../node_modules/jasmine-es6/lib/install.js",
    "../node_modules/adana-dump/index.js",
    "helpers/**/*.js"
  ]
}
```

Start testing with jasmine:

```sh
#!/bin/sh
NODE_ENV="test" jasmine

# Upload coverage data to coveralls.
cat ./coverage/coverage.json \
  | ./node_modules/.bin/adana --format lcov \
  | ./node_modules/coveralls/bin/coveralls.js
```

### west

TODO: Write me!

## Tags

There is no `ignore` flag, but you can tag functions, branches or statements which can be used to determine relevant coverage information. This allows you to ask things like "Have I covered all the code that pertains to authentication in the file?" and "Has this run in IE covered all the IE-specific cases?". Existing `ignore` comments simply tag a function with the `ignore` tag.

 * Add a tag with `+tag`, remove a tag with `-tag`.
 * Tags above a function declaration apply to all code in that function.
 * Tags above a class declaration apply to all code in that class.
 * Tags before the first statement of a branch apply to the branch and its code.
 * Tags on a line apply to everything on that line.

```javascript

/* adana: +ie +firefox -chrome */
function foo(i) {
  ++i; // +chrome
  console.log('foo', i); // adana: +test
  return i;
}


if (foo(1)) {
  /* adana: +chrome */
  console.log('bar');
}
```

## FAQ

 * Why is `let i;`, `function foo() {}`, etc. not marked at all? – Some things are not executable code per se (i.e. declarations). They do nothing to effect program state and are therefore not instrumented.

## Configuration

There are a couple of configuration options available to control how your program is instrumented. They can be set via the standard mechanism babel employs for configuring transforms.

```js
{
  // Pattern to match to determine if the file should be covered. The pattern
  // must be matched for coverage to be enabled for the file. Takes precedence
  // over `ignore`.
  // See `only` of https://babeljs.io/docs/usage/options/
  only: 'src/**/*.js',
  // Pattern to match to determine if the file should NOT be covered. The
  // pattern must NOT be matched for coverage to be enabled for the file.
  // See `ignore` of https://babeljs.io/docs/usage/options/
  ignore: 'test/**/*',
  // Name of the global variable to store all the collected coverage information
  // in.
  global: '__coverage__'
}
```

## API

Again, this plugin is simply a [babel] transformer that injects markers to determine if specific parts of the code have been run. Usage is as a normal babel plugin:

```javascript
import {transform} from '@babel/core';

const result = transform('some code', {
  plugins: ['transform-adana']
});

// Access result.code, result.map and result.metadata.coverage
```

To collect information about code that has been instrumented, simply access the configured global variable, e.g. `__coverage__`.

```javascript
import vm from 'vm';
const sandbox = vm.createContext({});
sandbox.global = sandbox;
vm.runInContext(result.code, sandbox);
console.log(sandbox.__coverage__);
```

The `__coverage__` object has the following shape:

```javascript
{
  // Hash of the file.
  hash: '2892834823482374234234235',
  // Path to the file being instrumented.
  path: 'some/file.js',
  // Detailed information about every location that's been instrumented.
  locations: [{
    id: 0,
    loc: { start: { line: 0, column 0 }, end: { line: 0, column: 0 } },
    name: 'foo',
    group: 'bar',
    tags: [ 'tagA', 'tagB' ],
    count: 5
  }, {
    ...
  }, ...]
}
```

More useful processing of this object can be done with [adana-analyze].

[babel]: http://babeljs.io
[istanbul]: https://github.com/gotwarlost/istanbul
[mocha]: http://mochajs.org/
[jasmine]: http://jasmine.github.io/
[west]: https://www.github.com/izaakschroeder/west
[adana-cli]: https://www.github.com/adana-coverage/adana-cli
[adana-analyze]: https://www.github.com/adana-coverage/adana-analyze
[jasmine-es6]: https://github.com/vinsonchuong/jasmine-es6
