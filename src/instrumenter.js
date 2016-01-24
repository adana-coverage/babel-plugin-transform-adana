import { createHash } from 'crypto';
import { util } from 'babel-core';
import prelude from './prelude';
import meta from './meta';
import { applyRules, addRules } from './tags';

export function hash(code) {
  return createHash('sha1').update(code).digest('hex');
}

export function skip({ opts, file } = { }) {
  if (file && opts) {
    const { ignore = [], only } = opts;
    return util.shouldIgnore(
      file.opts.filename,
      util.arrayify(ignore, util.regexify),
      only ? util.arrayify(only, util.regexify) : null
    );
  }
  return false;
}

/**
 * Create an opaque, unique key for a given node. Useful for tagging the node
 * in separate places.
 * @param {Object} path Babel path to derive key from.
 * @returns {String} String key.
 */
export function key(path) {
  const node = path.node;
  if (node.loc) {
    const location = node.loc.start;
    return `${location.line}:${location.column}`;
  }
  throw new TypeError('Path must have valid location.');
}

/**
 * Some nodes need to marked as non-instrumentable; since babel will apply
 * our plugin to nodes we create, we have to be careful to not put ourselves
 * into an infinite loop.
 * @param {Object} node Babel AST node.
 * @returns {Object} Babel AST node that won't be instrumented.
 */
function X(node) {
  node.__adana = true;
  return node;
}

function ignore(path) {
  return (!path.node || !path.node.loc || path.node.__adana);
}

function standardize(listener) {
  return (path, state) => ignore(path) ? undefined : listener(path, state);
}

/**
 * Create the transform-adana babel plugin.
 * @param {Object} types As per `babel`.
 * @returns {Object} `babel` plugin object.
 */
export default function adana({ types }) {
  /**
   * Create a chunk of code that marks the specified node as having
   * been executed.
   * @param {Object} state `babel` state for the path that's being walked.
   * @param {Object} options Configure how the marker behaves.
   * @returns {Object} AST node for marking coverage.
   */
  function createMarker(state, options) {
    const { tags, loc, name, group } = options;
    const coverage = meta(state);
    const id = coverage.entries.length;

    coverage.entries.push({
      id,
      loc,
      tags,
      name,
      group,
      count: 0,
    });

    // Maker is simply a statement incrementing a coverage variable.
    return X(types.unaryExpression('++', types.memberExpression(
      types.memberExpression(
        coverage.variable,
        types.numericLiteral(id),
        true
      ),
      types.stringLiteral('count'),
      true
    )));
  }

  /**
   * [isInstrumentableStatement description]
   * @param   {[type]}  path [description]
   * @returns {Boolean}      [description]
   */
  function isInstrumentableStatement(path) {
    const parent = path.parentPath;
    return !parent.isReturnStatement() &&
      !parent.isVariableDeclaration() &&
      !parent.isExportDeclaration() &&
      !parent.isFunctionDeclaration() &&
      !parent.isIfStatement();
  }

  /**
   * Inject a marker that measures whether the node for the given path has
   * been run or not.
   * @param {Object} path    [description]
   * @param {Object} state   [description]
   * @param {Object} options [description]
   * @returns {void}
   */
  function instrument(path, state, options) {
    // This function is here because isInstrumentableStatement() is being
    // called; we can't create the marker without knowing the result of that,
    // otherwise dead markers will be created.
    function marker() {
      return createMarker(state, {
        loc: path.node.loc,
        ...options,
      });
    }

    if (path.isBlockStatement()) {
      path.unshiftContainer('body', X(types.expressionStatement(marker())));
    } else if (path.isExpression()) {
      path.replaceWith(X(types.sequenceExpression([ marker(), path.node ])));
    } else if (path.isStatement()) {
      if (isInstrumentableStatement(path)) {
        path.insertBefore(X(types.expressionStatement(marker())));
      }
    }
  }

  /**
   * [visitStatement description]
   * @param {[type]} path  [description]
   * @param {[type]} state [description]
   * @returns {void}
   */
  function visitStatement(path, state) {
    instrument(path, state, {
      tags: [ 'statement', 'line' ],
      loc: path.node.loc,
    });
  }

  /**
   * The function visitor is mainly to track the definitions of functions;
   * being able ensure how many of your functions have actually been invoked.
   * @param {[type]} path  [description]
   * @param {[type]} state [description]
   * @returns {void}
   */
  function visitFunction(path, state) {
    instrument(path.get('body'), state, {
      tags: [ 'function' ],
      name: path.node.id ? path.node.id.name : `@${key(path)}`,
      loc: path.node.loc,
    });
  }

  /**
   * Multiple branches based on the result of `case _` and `default`. If you
   * do not provide a `default` one will be intelligently added for you,
   * forcing you to cover that case.
   * @param {[type]} path  [description]
   * @param {[type]} state [description]
   * @returns {void}
   */
  function visitSwitchStatement(path, state) {
    let hasDefault = false;
    path.get('cases').forEach(entry => {
      if (entry.node.test) {
        addRules(state, entry.node.loc, entry.node.test.trailingComments);
      }
      if (entry.node.consequent.length > 1) {
        addRules(
          state,
          entry.node.loc,
          entry.node.consequent[0].leadingComments
        );
      }

      if (entry.node.test === null) {
        hasDefault = true;
      }
      entry.unshiftContainer('consequent', createMarker(state, {
        tags: [ 'branch' ],
        loc: entry.node.loc,
        group: key(path),
      }));
    });

    // Default is technically a branch, just like if statements without
    // else's are also technically a branch.
    if (!hasDefault) {
      // Add an extra break to the end of the last case in case some idiot
      // forgot to add it.
      const cases = path.get('cases');
      if (cases.length > 0) {
        cases[cases.length - 1].pushContainer(
          'consequent',
          types.breakStatement()
        );
      }
      // Finally add the default case.
      path.pushContainer('cases', types.switchCase(null, [
        types.expressionStatement(createMarker(state, {
          tags: [ 'branch' ],
          loc: {
            start: path.node.loc.end,
            end: path.node.loc.end,
          },
          group: key(path),
        })),
        types.breakStatement(),
      ]));
    }
  }

  /**
   * [visitVariableDeclaration description]
   * @param {[type]} path  [description]
   * @param {[type]} state [description]
   * @returns {void}
   */
  function visitVariableDeclaration(path, state) {
    path.get('declarations').forEach(decl => {
      if (decl.has('init')) {
        instrument(decl.get('init'), state, {
          tags: [ 'statement', 'variable', 'line' ],
        });
      }
    });
  }

  /**
   * Includes both while and do-while loops. They contain a single branch which
   * tests the loop condition.
   * @param {[type]} path  [description]
   * @param {[type]} state [description]
   * @returns {void}
   */
  function visitWhileLoop(path, state) {
    const test = path.get('test');
    const group = key(path);
    // This is a particularly clever use of the fact JS operators are short-
    // circuiting. To instrument a loop one _cannot_ add a marker on the outside
    // of the loop body due to weird cases of things where loops are in non-
    // block if statements. So instead, create the following mechanism:
    // ((condition && A) || !B) where A and B are markers. Since markers are
    // postfix, they're always true. Ergo, A is only incremented when condition
    // is true, B only when it's false and the truth value of the whole
    // statement is preserved. Neato.
    test.replaceWith(types.logicalExpression(
      '||',
      types.logicalExpression(
        '&&',
        X(test.node),
        createMarker(state, {
          tags: [ 'branch', 'line', 'statement' ],
          loc: test.node.loc,
          group,
        })
      ),
      types.unaryExpression(
        '!',
        createMarker(state, {
          tags: [ 'branch', 'line' ],
          loc: test.node.loc,
          group,
        })
      )
    ));
  }

  /**
   * The try block can either fully succeed (no error) or it can throw. Both
   * cases are accounted for.
   * @param {[type]} path  [description]
   * @param {[type]} state [description]
   * @returns {void}
   */
  function visitTryStatement(path, state) {
    const group = key(path);
    path.get('block').pushContainer('body', types.expressionStatement(
      createMarker(state, {
        tags: [ 'branch', 'line' ],
        loc: path.get('block').node.loc,
        group,
      })
    ));
    if (path.has('handler')) {
      path.get('handler.body').unshiftContainer(
        'body',
        types.expressionStatement(
          createMarker(state, {
            tags: [ 'branch', 'line' ],
            loc: path.get('handler').node.loc,
            group,
          })
        )
      );
    } else {
      const loc = path.get('block').node.loc.end;
      path.get('handler').replaceWith(types.catchClause(
        types.identifier('err'), types.blockStatement([
          types.expressionStatement(
            createMarker(state, {
              tags: [ 'branch' ],
              loc: {
                start: loc,
                end: loc,
              },
              group,
            })
          ),
          types.throwStatement(
            types.identifier('err')
          ),
        ])
      ));
    }
  }

  /**
   * Return statements are instrumented by marking the next block they return.
   * This helps ensure multi-line expressions for return statements are
   * accurately captured.
   * @param   {[type]} path  [description]
   * @param   {[type]} state [description]
   * @returns {[type]}       [description]
   */
  function visitReturnStatement(path, state) {
    if (!path.has('argument')) {
      path.get('argument').replaceWith(types.sequenceExpression([
        createMarker(state, {
          loc: path.node.loc,
          tags: [ 'line', 'statement' ],
        }),
        types.identifier('undefined'),
      ]));
    } else {
      instrument(path.get('argument'), state, {
        tags: [ 'line', 'statement' ],
      });
    }
  }

  /**
   * For multi-line reporting (and objects do tend to span multiple lines) this
   * is required to know which parts of the object where actually executed.
   * Ignore shorthand property that look like `{ this }`.
   * @param   {[type]} path  [description]
   * @param   {[type]} state [description]
   * @returns {[type]}       [description]
   */
  function visitObjectProperty(path, state) {
    if (!path.node.shorthand && !path.parentPath.isPattern()) {
      const key = path.get('key');
      const value = path.get('value');
      if (key.isExpression()) {
        instrument(key, state, {
          tags: [ 'line' ],
        });
      }
      instrument(value, state, {
        tags: [ 'line' ],
      });
    }
  }

  /**
   * For multi-line reporting (and arrays do tend to span multiple lines) this
   * is required to know which parts of the array where actually executed.
   * This does _not_ include destructed arrays.
   * @param   {[type]} path  [description]
   * @param   {[type]} state [description]
   * @returns {[type]}       [description]
   */
  function visitArrayExpression(path, state) {
    if (!path.parentPath.isPattern()) {
      path.get('elements').forEach(element => {
        instrument(element, state, {
          tags: [ 'line' ],
        });
      });
    }
  }

  /**
   * Logical expressions are those using logic operators like `&&` and `||`.
   * Since logic expressions short-circuit in JS they are effectively branches
   * and will be treated as such here.
   * @param {[type]} path  [description]
   * @param {[type]} state [description]
   * @returns {void}
   */
  function visitLogicalExpression(path, state) {
    const group = key(path);
    const test = path.scope.generateDeclaredUidIdentifier('test');

    path.replaceWith(X(types.conditionalExpression(
      types.assignmentExpression('=', test, X(path.node)),
      types.sequenceExpression([ createMarker(state, {
        tags: [ 'branch' ],
        loc: path.get('left').node.loc,
        group,
      }), test ]),
      types.sequenceExpression([ createMarker(state, {
        tags: [ 'branch' ],
        loc: path.get('right').node.loc,
        group,
      }), test ])
    )));
  }

  /**
   * Conditionals are either if/else statements or tenaiary expressions. They
   * have a test case and two choices (based on the test result). Both cases
   * are always accounted for, even if the code does not exist for the alternate
   * case.
   * @param {[type]} path  [description]
   * @param {[type]} state [description]
   * @returns {void}
   */
  function visitConditional(path, state) {
    // Branches can be grouped together so that each of the possible branch
    // destinations is accounted for under one group. For if statements, this
    // refers to all the blocks that fall under a single if.. else if.. else..
    // grouping.
    const root = path.findParent(search => {
      return search.node.type === path.node.type &&
        (!search.parentPath || search.parentPath.node.type !== path.node.type);
    }) || path;

    // Create the group name based on the root `if` statement.
    const group = key(root);

    function tagBranch(path) {
      addRules(state, path.node.loc, path.node.leadingComments);
      if (path.isBlockStatement() && path.node.body.length > 0) {
        addRules(state, path.node.loc, path.node.body[0].leadingComments);
      }
    }

    tagBranch(path.get('consequent'));
    if (path.has('alternate')) {
      tagBranch(path.get('alternate'));
    }

    instrument(path.get('consequent'), state, {
      tags: [ 'branch', 'line' ],
      loc: path.node.consequent.loc,
      group,
    });

    if (path.has('alternate') && !path.get('alternate').isIfStatement()) {
      instrument(path.get('alternate'), state, {
        tags: [ 'branch', 'line' ],
        loc: path.node.alternate.loc,
        group,
      });
    } else if (!path.has('alternate')) {
      path.get('alternate').replaceWith(types.expressionStatement(
        createMarker(state, {
          tags: [ 'branch' ],
          loc: {
            start: path.node.loc.end,
            end: path.node.loc.end,
          },
          group,
        }))
      );
    }
  }

  const visitor = {
    // Expressions
    ArrowFunctionExpression: visitFunction,
    FunctionExpression: visitFunction,
    LogicalExpression: visitLogicalExpression,
    ConditionalExpression: visitConditional,
    ObjectProperty: visitObjectProperty,
    ArrayExpression: visitArrayExpression,

    // Declarations
    FunctionDeclaration: visitFunction,
    VariableDeclaration: visitVariableDeclaration,

    // Statements
    ContinueStatement: visitStatement,
    BreakStatement: visitStatement,
    ExpressionStatement: visitStatement,
    ThrowStatement: visitStatement,
    ReturnStatement: visitReturnStatement,
    TryStatement: visitTryStatement,
    WhileStatement: visitWhileLoop,
    DoWhileStatement: visitWhileLoop,
    IfStatement: visitConditional,
    SwitchStatement: visitSwitchStatement,
  };

  Object.keys(visitor).forEach(key => {
    visitor[key] = standardize(visitor[key]);
  });

  // Create the actual babel plugin object.
  return {
    visitor: {
      Program(path, state) {
        // Check if file should be instrumented or not.
        if (skip(state)) {
          return;
        }
        meta(state, {
          hash: hash(state.file.code),
          entries: [],
          rules: [],
          tags: {},
          variable: path.scope.generateUidIdentifier('coverage'),
        });
        path.traverse(visitor, state);
        applyRules(state);
        path.unshiftContainer('body', prelude(state));
      },
    },
  };
}
