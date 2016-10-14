function zz(x) {
  return x;
}
const foo = true;
zz(/* adana-no-instrument */ foo ? 'bar.js' : 'baz.js');
