import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import mkdirp from 'mkdirp';

export default function dump({ coverage, path, pretty }) {
  if (typeof coverage !== 'undefined') {
    const file2 = join(path, 'coverage.json');
    const data = pretty ?
      JSON.stringify(coverage, null, '  ') : JSON.stringify(coverage);
    mkdirp.sync(dirname(file2));
    writeFileSync(file2, data);
  }
}
