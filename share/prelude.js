/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable metalab/import/no-commonjs */
/* eslint-disable metalab/babel/no-invalid-this */
const VARIABLE = ((exports) => {
  exports[GLOBAL] = exports[GLOBAL] || { };
  const coverage = exports[GLOBAL][FILE] = {
    source: SOURCE,
    path: FILE,
    locations: LOCATIONS,
  };
  return coverage.locations;
})(
  typeof global !== 'undefined' ? global : this
);
