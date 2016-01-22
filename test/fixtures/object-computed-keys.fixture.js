function foo() {
  return 'hello';
}

const object = {
  [foo()]: 5,
};

++object.hello;
