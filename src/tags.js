
const COMMENT_PATTERN = /^\s*@?(adana|coverage|test|istanbul):? (.*)/;
// const TAG_PATTERN = /[+-]\s?(\w+)/g;

export default function tags(path) {
  return path.getAncestry()
    .map(n => n.node.leadingComments || [])
    .reduce((entries, comment) => {
      const result = COMMENT_PATTERN.exec(comment.value);
      return result ? [...entries, result[2]] : entries;
    }, []);
}
