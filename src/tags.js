import meta from './meta';

const COMMENT_PATTERN = /^\s*@?(adana|coverage|test|istanbul):?\s*(.*)\s*/;

function within(a, b) {
  return a.start.line >= b.start.line &&
    a.start.column >= b.start.column &&
    a.end.line <= b.end.line &&
    a.end.column <= b.end.column;
}

export function applyRules(state) {
  const coverage = meta(state);
  coverage.entries.forEach(entry => {
    const result = { };
    const output = [ ];
    entry.tags.forEach(tag => result[tag] = true);
    coverage.rules.forEach(rule => {
      if (within(rule.loc, entry.loc)) {
        result[rule.tag] = rule.value;
      }
    });
    Object.keys(result).forEach(tag => {
      const value = result[tag];
      if (value) {
        output.push(tag);
      }
    });
    entry.tags = output;
  });
}

export function extract(comment) {
  const output = { };
  const result = COMMENT_PATTERN.exec(comment);
  if (result) {
    const entries = result[2].split(/\s+/);
    entries.forEach(entry => {
      switch (entry.charAt(0)) {
      case '+':
        output[entry.substr(1)] = true;
        break;
      case '-':
        output[entry.substr(1)] = false;
        break;
      default:
        break;
      }
    });
  }
  return output;
}

export function addRules(state, loc, comments) {
  if (comments) {
    const coverage = meta(state);
    comments.forEach(comment => {
      const values = extract(comment.value);
      Object.keys(values).forEach(tag => {
        coverage.rules.push({
          tag,
          value: values[tag],
          loc,
        });
      });
    });
  }
}
