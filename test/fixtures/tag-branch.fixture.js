let i = 1;

if (i > 2) /* adana: +foo */ {
  i = i + 5;
} else if (i > 1) {
  /* adana: +bar */
  i = i + 1;
} else {
  /* adana: +baz */
  i = i - 1;
}

switch (i) {
case 0 /* adana: +foo */:
  i = 3;
  break;
case 1:
  /* adana: +bar */
  i = 5;
  break;
case 2 /* adana: +baz */:
  i = 7;
  break;
default:
  /* adana: +qux */
  i = 0;
  break;
}

let j = i > 3 ?
  /* adana: +foo */ 0 : /* adana: +bar */ 1;

++j;
