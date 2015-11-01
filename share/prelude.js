/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
const VARIABLE = (exports => {
  const hasTypedArray = typeof Uint32Array !== 'undefined';
  const counters = hasTypedArray ? new Uint32Array(COUNT) : [ ];

  function reset() {
    for (let i = 0; i < counters.length; ++i) {
      counters[i] = 0;
    }
  }

  exports.__coverage__ = exports.__coverage__ || { };
  exports.__coverage__[FILE] = {
    path: FILE,
    counters: counters,
    locations: LOCATIONS,
  };

  if (!hasTypedArray) {
    reset();
  }

  return counters;
})(
  typeof global !== 'undefined' ? global : this
);
