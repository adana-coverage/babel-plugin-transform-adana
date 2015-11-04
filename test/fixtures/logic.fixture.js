let y = true;
const a = !y;
const b = y;
const c = y;
const d = y;

y = !a || (b && c) || d;
