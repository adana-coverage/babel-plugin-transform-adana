
import prelude from './prelude';
import meta from './meta';

/**
 * Create an opaque, unique key for a given node. Useful for tagging the node
 * in separate places.
 * @param {Object} node Babel node to derive key from.
 * @returns {String} String key.
 */
function key(node) {
  if (node.loc) {
    const location = node.loc.start;
    return `${location.line}:${location.column}`;
  }
  // TODO: Determine a branch name when location is lacking.
  return 'lolol';
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
    const { type, loc, name, group } = options;
    const coverage = meta(state);
    const id = coverage.entries.length;

    coverage.entries.push({
      id,
      loc,
      type,
      name,
      group,
    });

    // Maker is simply a statement incrementing a coverage variable.
    return X(types.unaryExpression('++', types.memberExpression(
      coverage.variable,
      types.numberLiteral(id),
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
      !parent.isExportDefaultDeclaration() &&
      !parent.isFunctionDeclaration() &&
      !parent.isIfStatement();
  }

  /**
   * [instrument description]
   * @param   {[type]} path    [description]
   * @param   {[type]} state   [description]
   * @param   {[type]} options [description]
   * @returns {[type]}         [description]
   */
  function instrument(path, state, options) {
    if (!path.node || !path.node.loc || path.node.__adana) {
      return;
    }

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
    } else {
      throw new TypeError(path);
    }
  }

  /**
   * [visitStatement description]
   * @param {[type]} path  [description]
   * @param {[type]} state [description]
   * @returns {void}
   */
  function visitStatement(path, state) {
    instrument(path, state, { type: 'statement' });
  }

  /**
   * The function visitor is mainly to track the definitions of functions;
   * being able ensure how many of your functions have actually been invoked.
   * @param {[type]} path  [description]
   * @param {[type]} state [description]
   * @returns {void}
   */
  function visitFunction(path, state) {
    if (!path.node.loc) {
      return;
    }
    instrument(path.get('body'), state, {
      type: 'function',
      name: path.node.id ? path.node.id.name : `@${key(path.node)}`,
      loc: {
        start: path.node.loc.start,
        end: path.node.body.loc,
      },
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
      if (entry.node.test === null) {
        hasDefault = true;
      }
      entry.unshiftContainer('consequent', createMarker(state, {
        type: 'branch',
        loc: path.node.loc,
        group: key(path.node),
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
        createMarker(state, {
          type: 'branch',
          loc: {
            start: path.node.loc.end,
            end: path.node.loc.end,
          },
          group: key(path.node),
        }),
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
        instrument(decl.get('init'), state, { type: 'statement' });
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
    // This is a particularly clever use of the fact JS operators are short-
    // circuiting. To instrument a loop one _cannot_ add a marker on the outside
    // of the loop body due to weird cases of things where loops are in non-
    // block if statements. So instead, create the following mechanism:
    // ((condition && A) || !B) where A and B are markers. Since markers are
    // postfix, they're always true. Ergo, A is only incremented when condition
    // is true, B only when it's false and the truth value of the whole
    // statement is preserved. Neato.
    test.replaceWith(types.binaryExpression(
      '||',
      types.binaryExpression(
        '&&',
        test.node,
        createMarker(state, {
          type: 'branch',
          loc: test.node.loc,
          group: key(test.node),
        })
      ),
      types.unaryExpression(
        '!',
        createMarker(state, {
          type: 'branch',
          loc: test.node.loc,
          group: key(test.node),
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
    path.get('block').pushContainer('body', types.expressionStatement(
      createMarker(state, {
        type: 'branch',
        loc: path.get('block').node.loc,
        group: key(path.node),
      })
    ));
    if (path.has('handler')) {
      path.get('handler.body').unshiftContainer(
        'body',
        types.expressionStatement(
          createMarker(state, {
            type: 'branch',
            loc: path.get('handler').node.loc,
            group: key(path.node),
          })
        )
      );
    } else {
      // TODO: Give the catch an empty handler
      path.get('handler').replaceWith();
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
    instrument(path.get('left'), state, { type: 'branch' });
    instrument(path.get('right'), state, { type: 'branch' });
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
    if (!path.node.loc) {
      return;
    }
    // Branches can be grouped together so that each of the possible branch
    // destinations is accounted for under one group. For if statements, this
    // refers to all the blocks that fall under a single if.. else if.. else..
    // grouping.
    const root = path.findParent(search => {
      return search.node.type === path.node.type &&
        (!search.parentPath || search.parentPath.node.type !== path.node.type);
    }) || path;

    // Create the group name based on the root `if` statement.
    const group = key(root.node);

    instrument(path.get('consequent'), state, {
      type: 'branch',
      loc: {
        start: path.node.loc.start,
        end: path.node.consequent.loc.start,
      },
      group: group,
    });

    if (path.has('alternate') && !path.get('alternate').isIfStatement()) {
      instrument(path.get('alternate'), state, {
        type: 'branch',
        loc: {
          start: path.node.consequent.loc ?
            path.node.consequent.loc.end : path.node.loc,
          end: path.node.alternate.loc.start,
        },
        group: group,
      });
    } else if (!path.has('alternate')) {
      path.get('alternate').replaceWith(types.expressionStatement(
        createMarker(state, {
          type: 'branch',
          loc: {
            start: path.node.loc.end,
            end: path.node.loc.end,
          },
          group: group,
        }))
      );
    }
  }

  // Create the actual babel plugin object.
  return {
    visitor: {
      Program: {
        enter(path, state) {
          meta(state, {
            entries: [],
            variable: path.scope.generateUidIdentifier('coverage'),
          });
        },
        exit(path, state) {
          path.unshiftContainer('body', prelude(state));
        },
      },

      // Expressions
      ArrowFunctionExpression: visitFunction,
      FunctionExpression: visitFunction,
      LogicalExpression: visitLogicalExpression,
      ConditionalExpression: visitConditional,

      // Declarations
      FunctionDeclaration: visitFunction,
      VariableDeclaration: visitVariableDeclaration,

      // Statements
      Statement: visitStatement,
      TryStatement: visitTryStatement,
      WhileStatement: visitWhileLoop,
      DoWhileStatement: visitWhileLoop,
      IfStatement: visitConditional,
      SwitchStatement: visitSwitchStatement,
    },
  };
}
