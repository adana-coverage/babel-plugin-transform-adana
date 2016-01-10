/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
const VARIABLE = (exports => {
  exports[GLOBAL] = exports[GLOBAL] || { };
  const coverage = exports[GLOBAL][FILE] = {
    hash: HASH,
    path: FILE,
    locations: LOCATIONS,
  };
  return coverage.locations;
})(
  typeof global !== 'undefined' ? global : this
);
