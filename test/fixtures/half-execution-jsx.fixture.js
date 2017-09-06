const React = {createElement: () => {}};

function fail() {
  throw new Error();
}

function component() {
  return (
    <div>
      <span>Hello</span>
      {fail()}
      <span>World</span>
    </div>
  );
}

try {
  component();
} catch (err) {
  let i = 0;
  ++i;
}
