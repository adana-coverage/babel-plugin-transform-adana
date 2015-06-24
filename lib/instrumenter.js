
import { types } from 'babel-core';
import { groupBy, assign } from 'lodash';
import { createHash } from 'crypto';

function blockify(node) {
	if (!node) {
		return types.blockStatement()
	} else if (node.type === 'BlockStatement') {
		return node;
	} else {
		return types.blockStatement([ node ]);
	}
}

export default class Instrumenter  {

	constructor(options) {

		// local id -> { location, type }
		//
		this.map = {
			functions: [],
			statements: [],
			branches: []
		};
		this.markers = [ ];
		this.variable = '__coverage__';
	}

	/*
	get stats() {
		return groupBy(this.map, entry => {
			return entry.type;
		});
	}*/

	id(node) {
		const id = this.markers.length;
		this.markers.push({
			location: node.loc
		});
		return id;
	}

	context(file) {
		return 'x' + createHash('sha1').update(file).digest('hex');
	}

	/**
	 * Check if the given AST node is a marker.
	 * @param {Object} node AST node.
	 * @returns {Boolean} True if marker, false otherwise.
	 */
	isMarker(node) {
		return types.isExpressionStatement(node) &&
			types.isUnaryExpression(node.expression);
	}

	/**
	 * Create a chunk of code that marks the specified node as having
	 * been executed.
	 * @param {Object} node AST node that's being covered.
	 * @returns {Object} AST node for marking coverage.
	 */
	marker(variable, node) {
		return types.expressionStatement(
			types.unaryExpression(
				'++',
				types.memberExpression(
					types.identifier(variable),
					types.identifier(this.id(node))
				)
			)
		);
	}

	prelude(variable, scope) {
		// var randvar = global || window || this;
		// randvar.__coverage__ = randvar.__coverage__ || { };
		// randvar = randvar.__coverage__[__filename] = initial;

		//var tmp = scope.generateUidIdentifierBasedOnNode(ref);

		// Pick the first defined value from the list of values given.
		function first(value, ...rest) {
			if (rest.length === 0) {
				return types.identifier(value);
			}
			return types.conditionalExpression(
				types.binaryExpression(
					'!==',
					types.unaryExpression('typeof', types.identifier(value)),
					types.literal('undefined')
				),
				types.identifier(value),
				first(...rest)
			);
		}

		return [
			// var variable;
			types.variableDeclaration('var', [
				types.variableDeclarator(
					types.identifier('__global'),
					first('global', 'window', 'this')
				),
				types.variableDeclarator(
					types.identifier('__coverage'),
					first('global', 'window', 'this')
				)
			]),

			types.expressionStatement(
				types.assignmentExpression(
					'=',
					types.memberExpression(
						types.identifier(this.variable),
						types.identifier(context)
					),
					types.newExpression(
						types.identifier('Uint8Array'),
						[types.literal(this.markers.length)]
					)
				)
			)
		];
	}

	visitor() {
		var self = this, context;

		function Statement(node) {
			if (self.isMarker(node)) {
				return node;
			}
			return [
				self.marker(context, node),
				node
			];
		}

		function Loop(node) {
			return assign({ }, node, {
				body: blockify(node.body)
			});
		}

		return {

			Program: {
				enter(node, parent, scope, formatter) {
					const file = formatter.opts.sourceFileName || formatter.opts.fileName;
					context = self.context(file);

					formatter.metadata.coverage = {
						context: context
					};

					return node;
				},
				exit(node) {
					node.body.unshift(...self.prelude(context));
					return node;
				}
			},

			FunctionDeclaration(node) {
				return node;
			},

			ArrowFunctionExpression(node) {
				if (node.expression) {
					return node.arrow(blockify(types.return(node.body)))
				} else {
					return node;
				}
			},

			ExpressionStatement: Statement,
			TryStatement: Statement,
			BreakStatement: Statement,
			ContinueStatement: Statement,
			DebuggerStatement: Statement,
			ReturnStatement: Statement,
			ThrowStatement: Statement,
			TryStatement: Statement,
			VariableDeclaration: Statement,
			LabeledStatement: Statement,
			ForStatement: Loop,
			ForInStatement: Loop,
			ForOfStatement: Loop,
			WhileStatement: Loop,
			DoWhileStatement: Loop


		}
	}


}
