
import analyze from './analyze';

export default function lcov(coverage) {
  const files = Object.keys(coverage);
  return files.map(file => {
    const {
      function: functions = [],
      line: lines = [],
      branch: branches = [],
    } = analyze(coverage[file]);
    return `
TN:
SF: ${file}
FNF: ${functions.length}
FNH: ${functions.covered}
LF: ${lines.length}
LH: ${lines.covered}
BRF: ${branches.length}
BRH: ${branches.covered}

${functions.map(({loc, name, count}) => `FN: ${loc.start.line}, ${name}
FNDA: ${count}, ${name}`).join('\n')}

${lines.map(({count, line}) => `DA: ${line}, ${count}`).join('\n')}

${branches.map(({loc, count, group}, id) => `
BRDA: ${loc.start.line}, ${id}, ${group}, ${count}`).join('\n')}

end_of_record`;
  }).join('\n');
}
