
function merge({ locations, counters }) {
  return locations.map((loc, index) => {
    const count = counters[index];
    return { ...loc, count, passed: count > 0 };
  });
}

function type(name, base) {
  const entries = base.filter(loc => loc.type === name);
  const covered = entries.reduce((sum, { passed }) => {
    return passed ? sum + 1 : sum;
  }, 0);

  entries.covered = covered;

  return entries;
}

function lines(statements) {
  const index = { };
  statements.forEach(entry => {
    for (let i = entry.loc.start.line; i <= entry.loc.end.line; ++i) {
      // If a statement hasn't been covered ensure the line is marked as
      // not covered.
      if (!entry.count || index[i] === 0) {
        index[i] = 0;
      } else {
        index[i] = Math.max(index[i] || 0, entry.count);
      }
    }
  });
  const result = Object.keys(index).map(line => {
    return {
      line: line,
      passed: index[line] > 0,
      count: index[line],
    };
  });
  result.covered = result.reduce((total, { passed }) => {
    return passed ? total + 1 : total;
  }, 0);
  return result;
}

export default function analyze(coverage) {
  const base = merge(coverage);
  const statements = type('statement', base);
  const branches = type('branch', base);
  const functions = type('function', base);
  return {
    statements,
    lines: lines(statements),
    branches,
    functions,
  };
}
