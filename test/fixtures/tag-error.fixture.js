let i = 0;

try /* adana: +foo */ {
  ++i;
} catch (err) /* adana: +baz */ {
  ++i;
}

try {
  throw new Error();
} catch (err) /* adana: +bar */ {
  ++i;
}
