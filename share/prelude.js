const $VARIABLE$ = (function(exports) {
	exports.__coverage__ = exports.__coverage__ || { };
	exports.__coverage__[$FILE$] = {
		counters: new Uint8Array($COUNT$),
		locations: $LOCATIONS$
	};
	return exports.__coverage__[$FILE$].counters;
})(
	typeof global !== 'undefined' ? global : this
);
