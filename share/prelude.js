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
