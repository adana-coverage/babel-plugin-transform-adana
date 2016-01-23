
const qux = true;

function x() {
  throw new Error();
}

function y() {
  return [
    qux,
    5,
    x(),
    7,
  ];
}

function z() {
  try {
    return y();
  } catch (err) {
    return [];
  }
}

z();
