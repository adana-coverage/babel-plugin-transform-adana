
import fs from 'fs';
import { groupBy, assign, map, flatten, reduce } from 'lodash';

function flow(...chain) {
	return function(node, ...args) {
		for (let elem of chain) {
			node = elem.call(this, node, ...args);
		}
		return node;
	}
}

function ancestors(path) {
	var res = [];
	while (path) {
		res.unshift(path.node);
		path = path.parentPath;
	}
	return res;
}

function tags(path) {
	const results = flatten(map(ancestors(path), n => n.leadingComments || []));
	return reduce(results, (current, comment) => {
		const result = COMMENT_PATTERN.exec(comment.value);
		return current;
	}, { });
}

const defaults = {
	prelude: fs.readFileSync(  './share/prelude.js', 'utf8')
};

const COMMENT_PATTERN = /^\s*@?(adana|coverage|test|istanbul):? (.*)/;
const TAG_PATTERN = /[+-]\s?(\w+)/g;

export default function ({ Plugin, types, parse, traverse }) {

	function astify(literal) {
		switch (typeof literal) {
		case 'number':
		case 'string':
		case 'boolean':
		case 'null':
		case 'undefined':
			return types.literal(literal);
		default:
			if (Array.isArray(literal)) {
				return types.arrayExpression(literal.map(astify));
			} else {
				return types.objectExpression(Object.keys(literal).map(k => {
					return types.property(
						'init',
						types.literal(k),
						astify(literal[k])
					);
				}));
			}
		}
	}

	function prelude(file) {

		const coverage = file.metadata.coverage;
		const name = file.opts.sourceFileName || file.opts.fileName;
		const lemap = {
			'$VARIABLE$': types.identifier(coverage.variable),
			'$FILE$': types.literal(name),
			'$LOCATIONS$': astify(coverage.entries),
			'$COUNT$': types.literal(coverage.entries.length)
		};

		const preL = parse(defaults.prelude);

		traverse(preL, {
				Identifier(node) {
					if (node.name in lemap) {
						return lemap[node.name];
					}
				}
		});

		return preL.program.body;
	}



	/**
	 * Check if an AST node is a pragma directive like `use strict` or
	 * `use babel` or whatever.
	 * @param {Object} node Node to check.
	 * @returns {Boolean} True if pragma, false otherwise.
	 */
	function isPragma(node) {
		return types.isExpressionStatement(node) &&
			types.isLiteral(node.expression) &&
			typeof node.expression.value === 'string' &&
			/^use ./.test(node.expression.value);
	}

	/**
	 * Check if the given AST node should NOT be instrumented.
	 * @param {Object} node AST node.
	 * @returns {Boolean} True if ignored, false otherwise.
	 */
	function ignore(node) {
		return isPragma(node);
	}


	function mkblock(node) {
		if (!node) {
			return types.blockStatement()
		} else if (types.isBlockStatement(node)) {
			return node;
		} else if (Array.isArray(node)) {
			return types.blockStatement(node);
		} else {
			return types.blockStatement([ node ]);
		}
	}

	function blockify(...props) {
		return function(node) {
			const res = { };
			for (let prop of props) {
				if (!types.isBlockStatement(node[prop])) {
					res[prop] = mkblock(node[prop])
				}
			}
			return assign(node, res);
		}
	}

	/**
	 * Create a chunk of code that marks the specified node as having
	 * been executed.
	 * @param {Object} node AST node that's being covered.
	 * @returns {Object} AST node for marking coverage.
	 */
	function increment(options) {
		const { source, node, type, file, loc } = options;
		const root = source || node;
		const origin = loc || root.loc;
		const coverage = file.metadata.coverage;

		const id = coverage.entries.length;

		coverage.entries.push({
			loc: origin,
			type: type
		});

		return types.unaryExpression('++', types.memberExpression(
			types.identifier(coverage.variable),
			types.identifier(id)
		));
	}

	function pair(options) {

		const { node } = options;

		if (ignore(node)) {
			return node;
		}

		const marker = increment(options);

		if (types.isBlockStatement(node)) {
			const {pragmas, statements} = groupBy(
				node.body,
				entry => isPragma(entry) ? 'pragmas' : 'statements'
			);
			return assign(node, {
				body: [
					...(pragmas || []),
					marker,
					...(statements || [])
				]
			});
		} else if (types.isExpression(node)) {
			return types.sequenceExpression([
				marker,
				node
			]);
		} else if (Array.isArray(node)) {
			return [
				marker,
				...node
			];
		} else {
			throw new TypeError(node);
		}
	}

	function Statement(node, parent, scope, file) {
		if (!ignore(node)) {
			return [
				increment({ node: node, type: 'statement', file: file }),
				node
			];
		}
		return node;
	}


	function F(node, parent, scope, file) {
		return assign(node, {
			body: pair({
				type: 'function',
				node: node.body,
				source: node,
				file: file,
				loc: {
					start: node.loc.start,
					end: node.body.loc
				}
			})
		});
	}

	function sw(node, parent, scope, file) {
		return assign(node, {
			consequent: pair({
				type: 'branch',
				node: node.consequent,
				source: node,
				file: file
			})
		});
	}

	function Variables(node, parent, scope, file) {
		return assign(node, {
			declarations: map(node.declarations, decl => {
				return !decl.init ? decl : assign(decl, {
					init: pair({
						type: 'statement',
						node: decl.init,
						source: decl,
						file: file
					})
				});
			})
		});
	}

	function forloop(node) {
		return node;
	}

	function whileloop(node, parent, scope, file) {
		return assign(node, {
			test: pair({ type: 'statement', node: node.test, file: file })
		});
	}

	function logic(node, parent, scope, file) {
		return assign(node, {
			left: pair({ type: 'branch', node: node.left, file: file }),
			right: pair({ type: 'branch', node: node.right, file: file })
		});
	}



	function conditional(node, parent, scope, file) {
		const loc = { start: node.loc.start, end: node.loc.end };
		return assign(node, {
			consequent: pair({
				type: 'branch',
				loc: loc,
				node: node.consequent,
				file: file
			}),
			alternate: pair({
				type: 'branch',
				loc: loc,
				node: node.alternate,
				file: file
			})
		});
	}

	function arrow(node) {
		if (node.expression) {
			return types.arrowFunctionExpression(
				mkblock(types.returnStatement(node.body))
			);
		} else {
			return node;
		}
	}

	return new Plugin('adana', {
		visitor: {
			Program: {
				enter(node, parent, scope, file) {
					file.metadata.coverage = {
						entries: [],
						variable: '_cov' + Math.random().toString(36).substr(2)
					};
					return node;
				},
				exit(node, parent, scope, file) {
					node.body.unshift(...prelude(file));
					return node;
				}
			},

			ArrowFunctionExpression: arrow,
			FunctionExpression: F,
			FunctionDeclaration: flow(F, Statement),
			ExpressionStatement: Statement,
			TryStatement: Statement,
			BreakStatement: Statement,
			ContinueStatement: Statement,
			DebuggerStatement: Statement,
			ReturnStatement: Statement,
			ThrowStatement: Statement,
			TryStatement: Statement,
			VariableDeclaration: Variables,
			LabeledStatement: Statement,
			ForStatement: flow(blockify('body'), forloop, Statement),
			ForInStatement: flow(blockify('body'), Statement),
			ForOfStatement: flow(blockify('body'), Statement),
			WhileStatement: flow(blockify('body'), whileloop, Statement),
			DoWhileStatement: flow(blockify('body'), whileloop, Statement),
			LogicalExpression: logic,
			ConditionalExpression: conditional,
			SwitchStatement: Statement,
			SwitchCase: sw,
			IfStatement: flow(
				blockify('consequent', 'alternate'),
				conditional,
				Statement
			)
		}
	});
}
