
import prelude from './prelude';
import meta from './meta';

function key(location) {
  return `${location.line}:${location.column}`;
}

export default function adana({ types }) {
  /**
   * Create a chunk of code that marks the specified node as having
   * been executed.
   * @param {Object} state `babel` state for the path that's being walked.
   * @param {Object} options Configure how the marker behaves.
   * @returns {Object} AST node for marking coverage.
   */
  function createMarker(state, options) {
    const { source, type, loc, name, group } = options;
    const origin = loc || (source && source.node.loc);
    const coverage = meta(state);
    const id = coverage.entries.length;

    coverage.entries.push({
      id,
      loc: origin,
      type: type,
      name,
      group,
    });

    const marker = types.unaryExpression('++', types.memberExpression(
      coverage.variable,
      types.numberLiteral(id),
      true
    ));
    marker.__adana = true;
    return marker;
  }

  function X(node) {
    node.__adana = true;
    return node;
  }

  function isInstrumentableStatement(path) {
    const parent = path.parentPath;
    return !parent.isReturnStatement() &&
      !parent.isVariableDeclaration() &&
      !parent.isExportDefaultDeclaration() &&
      !parent.isFunctionDeclaration() &&
      !parent.isIfStatement();
  }

  function instrument(path, state, options) {
    if (!path.node || !path.node.loc || path.node.__adana) {
      return;
    }

    function marker() {
      return createMarker(state, {
        loc: path.node.loc,
        ...options,
      });
    }

    path.node.__adana = true;

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

  function visitStatement(path, state) {
    instrument(path, state, { type: 'statement' });
  }

  function visitFunction(path, state) {
    if (!path.node.loc) {
      return;
    }
    instrument(path.get('body'), state, {
      type: 'function',
      source: path,
      name: path.node.id ?
        path.node.id.name :
        `anonymous-${key(path.node.loc.start)}`,
      loc: {
        start: path.node.loc.start,
        end: path.node.body.loc,
      },
    });
  }

  function visitSwitchStatement(path, state) {
    let hasDefault = false;
    path.get('cases').forEach(entry => {
      if (entry.node.test === null) {
        hasDefault = true;
      }
      entry.unshiftContainer('consequent', createMarker(state, {
        type: 'branch',
        source: path,
        group: key(path.node.loc.start),
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
          source: path,
          group: key(path.node.loc.start),
        }),
        types.breakStatement(),
      ]));
    }
  }

  function visitVariableDeclaration(path, state) {
    path.get('declarations').forEach(decl => {
      if (decl.has('init')) {
        instrument(decl.get('init'), state, {
          type: 'statement',
          source: decl,
        });
      }
    });
  }

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
          group: key(test.node.loc),
        })
      ),
      types.unaryExpression(
        '!',
        createMarker(state, {
          type: 'branch',
          loc: test.node.loc,
          group: key(test.node.loc),
        })
      )
    ));
  }

  function visitTryStatement(path, state) {
    path.get('block').pushContainer('body', types.expressionStatement(
      createMarker(state, {
        type: 'branch',
        loc: path.get('block').node.loc,
        group: key(path.node.loc),
      })
    ));
    if (path.has('handler')) {
      path.get('handler.body').unshiftContainer(
        'body',
        types.expressionStatement(
          createMarker(state, {
            type: 'branch',
            loc: path.get('handler').node.loc,
            group: key(path.node.loc),
          })
        )
      );
    }
  }

  function visitLogicalExpression(path, state) {
    instrument(path.get('left'), state, { type: 'branch' });
    instrument(path.get('right'), state, { type: 'branch' });
  }

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
    const group = root.node.loc ? key(root.node.loc.start) : 'lol????';

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
