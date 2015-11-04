
let i = 0;

try {
  throw new Error('foo');
} finally {
  ++i;
}
