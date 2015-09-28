
function foo() {
  'use babel';
  'use strict';

  const a = 5;
  return a;
}

/* eslint-disable no-unused-vars */
function bar() {

}

foo();
foo();
