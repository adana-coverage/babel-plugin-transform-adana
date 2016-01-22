
const qux = true;

function x() {
  throw new Error();
}

function y() {
  return {
    qux,
    foo: 5,
    bar: x(),
    baz: 7,
  };
}

function z() {
  try {
    return y();
  } catch (err) {
    return {};
  }
}

z();
