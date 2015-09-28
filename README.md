# babel-plugin-transform-adana

Minimal, complete code-coverage tool for [babel] 6+.

![build status](http://img.shields.io/travis/izaakschroeder/babel-plugin-transform-adana/master.svg?style=flat)
![coverage](http://img.shields.io/coveralls/izaakschroeder/babel-plugin-transform-adana/master.svg?style=flat)
![license](http://img.shields.io/npm/l/babel-plugin-transform-adana.svg?style=flat)
![version](http://img.shields.io/npm/v/babel-plugin-transform-adana.svg?style=flat)
![downloads](http://img.shields.io/npm/dm/babel-plugin-transform-adana.svg?style=flat)

Has all the features of [istanbul] including line, function and branch coverage, but works as a babel plugin instead of relying on `esparse` and `escodegen`. Works great with [west], [mocha], [jasmine] and probably more.

Features:

 * First-class babel support,
 * Per-line/function/branch coverage,
 * Smart branch detection.

TODO:
  * Tagged instrumentation,
	* Convert branch/line/function to tag?
  * More test cases,
	* Split out bins/reporters into other modules.

## Usage

Install `adana`:

```sh
npm install --save-dev babel-plugin-transform-adana
```

Setup [babel] to use it:

```json
{
	"env": {
		"test": {
			"plugins": [
				"transform-adana"
			]
		}
	}
}
```

**IMPORTANT**: This plugin works best when it runs as the _first_ plugin in the babel transform list, since its purpose is to instrument your _original code_, not whatever other transformations happen to get made.

Extract the coverage data from node:

```sh
NODE_ENV="test" mocha \
	-r babel-plugin-transform-adana/dump \
	--compilers js:babel-core/register \
	test/*.spec.js
```

Run some checks:

```sh
adana-check --statements 100 --branches 100 --functions 100
```

```javascript
/* global __coverage__ */
import { writeFileSync } from 'fs';

// Dump that data to disk after tests have finished.
process.on('exit', () => {
	writeFileSync('coverage/coverage.json', JSON.stringify(__coverage__));
});

```

### Tags

There is no `ignore` flag, but you can tag functions, branches or statements to which can be used to determine relevant coverage information. This allows you to categorize blocks of code and ask things like "Have I covered all the code that pertains to authentication in the file?". Existing `ignore` comments simply tag a function with the `ignore` tag.

 * Tags above a block (if/function/etc.) to apply to all code in that block.
 * Tags above or on a line apply to all statements in that line.

```javascript


/* adana: +ie +firefox -chrome */
function foo() {
	console.log('foo'); // adana: +test
}

/* adana: +chrome */
if () {

}
```




### API

`adana` is simply a [babel] transformer that injects markers to determine if specific parts of the code have been run. To inject these markers simply add [adana] as a plugin and use [babel] normally:

```javascript
import { transform } from 'babel-core';

const result = transform('some code', {
	plugins: [ 'adana' ]
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
	// Array of counters; the index in this list maps to the same index in the
	// locations array.
	counters: [ 0, 0, ... ],
	// Detailed information about every location that's been instrumented.
	locations: [{
		loc: { start: { line: 0, column 0 }, end: { line: 0, column: 0 } },
		type: 'function|statement|branch',
		name: 'foo',
		group: 'bar',
		tags: [ 'tagA', 'tagB' ]
	}, {
		...
	}, ...]
}
```

### HMR Spec Coverage

foo.spec.js -> foo.js: overwrite coverage info only for foo.js

On HMR:
- clear coverage counters for reloaded modules
- run reloaded code
- replace coverage counters for reloaded modules


[babel]: http://babeljs.io
[istanbul]: https://github.com/gotwarlost/istanbul
[mocha]: http://mochajs.org/
[jasmine]: http://jasmine.github.io/
[west]: https://www.github.com/izaakschroeder/west
[lcov]: http://ltp.sourceforge.net/coverage/lcov/geninfo.1.php
