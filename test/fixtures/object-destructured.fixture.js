
function foo({environment: x}) {
  return x + 1;
}

function bar([a, b]) {
  return a + b;
}

foo({environment: 5});
bar([1, 2]);
