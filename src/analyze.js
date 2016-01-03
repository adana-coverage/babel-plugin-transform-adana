
function type(name, coverage) {
  const entries = (coverage.tags[name] || []).map(loc => {
    const count = coverage.counters[loc];
    return {
      ...coverage.locations[loc],
      count,
      passed: count > 0,
    };
  });
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
      if (i in index) {
        index[i] = Math.min(index[i], entry.count);
      } else {
        index[i] = entry.count;
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
  const results = { };
  Object.keys(coverage.tags).forEach(tag => results[tag] = type(tag, coverage));
  results.line = lines(results.line);
  return results;
}
