# adana

Use [babel] to provide code-coverage information.

Has all the features of [istanbul] including line, function and branch coverage, but works as a babel plugin instead of relying on `esparse` and `escodegen`. Works great with [west], [mocha], [jasmine] and probably more.

## Usage

```
npm install adana
```

### Tags

There is no `ignore` flag, but you can tag functions, branches or statements to which can be used to determine relevant coverage information.

```javascript

/* adana: +guard */

/* adana: +ie +firefox -chrome */
```




### API

[adana] is simply a [babel] transformer that injects markers to determine if specific parts of the code have been run. To inject these markers simply add [adana] as a plugin and use [babel] normally:

```javascript
import { transform } from 'babel-core';

const result = transform('some code', {
	plugins: [ 'adana' ]
});

// Access result.code, result.map and result.metadata.coverage
```

To collect information about code that has been instrumented, simply access the configured global variable.

```javascript
eval(result.code);
console.log(__COV);
```



### CLI

```sh
adana-cover mocha test/spec
adana-check --tags=ie,firefox
```

[babel]: http://babeljs.io
[istanbul]: https://github.com/gotwarlost/istanbul
[mocha]:
[jasmine]:
[west]: https://www.github.com/izaakschroeder/west
[lcov]: http://ltp.sourceforge.net/coverage/lcov/geninfo.1.php
