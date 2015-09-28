
const foo = false;
const bar = false;
const baz = true;

let x = 0;
let y = 0;
let z = 0;

// adana: +foo
if (foo) {
  ++x;
} else if (bar) {
  ++y;
} else if (baz) {
  ++z;
}
