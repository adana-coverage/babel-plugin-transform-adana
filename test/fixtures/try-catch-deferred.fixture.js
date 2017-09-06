
let i = 0;

const bar = () => {};

const foo = () => {
  try {
    return bar();
  } catch (err) {
    ++i;
  }
};

foo();
