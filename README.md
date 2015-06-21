# adana

Use [babel] to provide code-coverage information.

Has all the features of [istanbul] including line, function and branch coverage, but works as a babel plugin instead of relying on `esparse` and `escodegen`. Works great with [west], [mocha], [jasmine] and probably more.

## Usage

```
npm install adana
```

### API

```javascript
import { transform } from 'babel-core';

const result = transform('some code', {
	plugins: [ 'adana' ]
});
```

### CLI
