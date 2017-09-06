const ary = {5: true, 7: false, potato: 'hi'};
let sum = 0;

/* eslint guard-for-in:0 */
for (const i in ary) {
  sum += i;
}
