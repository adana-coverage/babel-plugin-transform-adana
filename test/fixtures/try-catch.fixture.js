
let i = 0;

try {
  throw new Error('foo');
} catch (err) {
  ++i;
} finally {
  ++i;
}
