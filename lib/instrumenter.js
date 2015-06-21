
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
	marker(context, node) {
		return types.expressionStatement(
			types.unaryExpression(
				'++',
				types.memberExpression(
					types.memberExpression(
						types.identifier(this.variable),
						types.identifier(context)
					),
					types.identifier(this.id(node))
				)
			)
		);
	}

	prelude(context) {
		return types.expressionStatement(
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
		);
	}

	visitor() {
		var self = this, context;
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
					node.body.unshift(self.prelude(context));
					return node;
				}
			},

			FunctionDeclaration(node) {
				return node;
			},

			ExpressionStatement(node, parent, scope, formatter) {
				if (self.isMarker(node)) {
					return node;
				}
				return [
					self.marker(context, node),
					node
				];
			}
		}
	}


	/*
	ArrowFunctionExpression: [ this.arrowBlockConverter ],
    ExpressionStatement: this.coverStatement,
    BreakStatement: this.coverStatement,
    ContinueStatement: this.coverStatement,
    DebuggerStatement: this.coverStatement,
    ReturnStatement: this.coverStatement,
    ThrowStatement: this.coverStatement,
    TryStatement: [ this.paranoidHandlerCheck, this.coverStatement],
    VariableDeclaration: this.coverStatement,
	IfStatement: [ this.ifBlockConverter, this.coverStatement, this.ifBranchInjector ],
    ForStatement: [ this.skipInit, this.loopBlockConverter, this.coverStatement ],
    ForInStatement: [ this.skipLeft, this.loopBlockConverter, this.coverStatement ],
    ForOfStatement: [ this.skipLeft, this.loopBlockConverter, this.coverStatement ],
    WhileStatement: [ this.loopBlockConverter, this.coverStatement ],
    DoWhileStatement: [ this.loopBlockConverter, this.coverStatement ],
    SwitchStatement: [ this.coverStatement, this.switchBranchInjector ],
    SwitchCase: [ this.switchCaseInjector ],
    WithStatement: [ this.withBlockConverter, this.coverStatement ],
    FunctionDeclaration: [ this.coverFunction, this.coverStatement ],
    FunctionExpression: this.coverFunction,
    LabeledStatement: this.coverStatement,
    ConditionalExpression: this.conditionalBranchInjector,
    LogicalExpression: this.logicalExpressionBranchInjector,
    ObjectExpression: this.maybeAddType

	IfStatement(node) {
		// Convert the if statement into a block
		return types.ifStatement(
			blockify(node.consequent),
			blockify(node.alternate)
		);

		// Cover the if statement itself

		// Cover the conditions in the if statement
		return types.ifStatement(
			types.blockStatement([xxx, ...node.consequent.body]),
			types.blockStatement([yyy, ...node.alternate.body])
		);
	}

	statement(node) {

	}
	*/

}
