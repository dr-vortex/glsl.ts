import { assert, string_get13, StringMap_set2, StringMap_get11, List_get2, string_slice22, StringMap_get3, StringMap_insert1 } from '../native-js.js';
import { CompilerData, ExtensionBehavior } from './compiler.js';
import { fold } from './folder.js';
import { Log } from './log.js';
import { Node, NodeKind, NodeKind_isBinary, NodeKind_isUnaryPostfix, NodeKind_isUnaryPrefix } from './node.js';
import { Include, ParserContext, Pratt, Precedence } from './pratt.js';
import { Range } from './range.js';
import { Resolver } from './resolver.js';
import { Scope, ScopeKind } from './scope.js';
import { FunctionSymbol, StructSymbol, SymbolFlags, VariableKind, VariableSymbol, _Symbol } from './symbol.js';
import { Token, TokenKind, TokenPurpose, tokenize } from './tokenizer.js';
import { Type } from './type.js';

export const enum Allow {
	AVOID_FUNCTIONS,
	ALLOW_FUNCTIONS,
}

export const enum ParseTypeMode {
	IGNORE_ERRORS,
	REPORT_ERRORS,
}

export class ParseResult {
	includes: Array<Include>;

	constructor(includes: Array<Include>) {
		this.includes = includes;
	}
}

export function typeParselet(type: Type): (v0: ParserContext, v1: Token) => Node {
	return (context: ParserContext, token: Token) => {
		return Node.createType(type).withRange(token.range);
	};
}

export function unaryPrefix(kind: NodeKind): (v0: ParserContext, v1: Token, v2: Node) => Node {
	assert(NodeKind_isUnaryPrefix(kind));
	return (context: ParserContext, token: Token, value: Node) => {
		return Node.createUnary(kind, value).withRange(Range.span(token.range, value.range)).withInternalRange(token.range);
	};
}

export function unaryPostfix(kind: NodeKind): (v0: ParserContext, v1: Node, v2: Token) => Node {
	assert(NodeKind_isUnaryPostfix(kind));
	return (context: ParserContext, value: Node, token: Token) => {
		return Node.createUnary(kind, value).withRange(Range.span(value.range, token.range)).withInternalRange(token.range);
	};
}

export function binaryParselet(kind: NodeKind): (v0: ParserContext, v1: Node, v2: Token, v3: Node) => Node {
	assert(NodeKind_isBinary(kind));
	return (context: ParserContext, left: Node, token: Token, right: Node) => {
		return Node.createBinary(kind, left, right).withRange(Range.span(left.range, right.range)).withInternalRange(token.range);
	};
}

export function parseInt(text: string): number {
	if (text.length > 1 && string_get13(text, 0) === 48 && string_get13(text, 1) !== 120 && string_get13(text, 1) !== 88) {
		return parseInt(text, 8);
	}

	return text | 0;
}

export function parseFloat(text: string): number {
	return +text;
}

export function createExpressionParser(): Pratt {
	let pratt = new Pratt();
	let invalidUnaryOperator: (v0: ParserContext, v1: Token, v2: Node) => Node = (context: ParserContext, token: Token, value: Node) => {
		context.log.syntaxErrorInvalidOperator(token.range);
		return Node.createUnknownConstant(Type.ERROR).withRange(Range.span(token.range, value.range));
	};
	let invalidBinaryOperator: (v0: ParserContext, v1: Node, v2: Token, v3: Node) => Node = (context: ParserContext, left: Node, token: Token, right: Node) => {
		context.log.syntaxErrorInvalidOperator(token.range);
		return Node.createUnknownConstant(Type.ERROR).withRange(Range.span(left.range, right.range));
	};
	pratt.literal(TokenKind.TRUE, (context: ParserContext, token: Token) => {
		return Node.createBool(true).withRange(token.range);
	});
	pratt.literal(TokenKind.FALSE, (context: ParserContext, token: Token) => {
		return Node.createBool(false).withRange(token.range);
	});
	pratt.literal(TokenKind.INT_LITERAL, (context: ParserContext, token: Token) => {
		return Node.createInt(parseInt(token.range.toString())).withRange(token.range);
	});
	pratt.literal(TokenKind.FLOAT_LITERAL, (context: ParserContext, token: Token) => {
		return Node.createFloat(parseFloat(token.range.toString())).withRange(token.range);
	});
	pratt.literal(TokenKind.BOOL, typeParselet(Type.BOOL));
	pratt.literal(TokenKind.BVEC2, typeParselet(Type.BVEC2));
	pratt.literal(TokenKind.BVEC3, typeParselet(Type.BVEC3));
	pratt.literal(TokenKind.BVEC4, typeParselet(Type.BVEC4));
	pratt.literal(TokenKind.FLOAT, typeParselet(Type.FLOAT));
	pratt.literal(TokenKind.INT, typeParselet(Type.INT));
	pratt.literal(TokenKind.IVEC2, typeParselet(Type.IVEC2));
	pratt.literal(TokenKind.IVEC3, typeParselet(Type.IVEC3));
	pratt.literal(TokenKind.IVEC4, typeParselet(Type.IVEC4));
	pratt.literal(TokenKind.MAT2, typeParselet(Type.MAT2));
	pratt.literal(TokenKind.MAT3, typeParselet(Type.MAT3));
	pratt.literal(TokenKind.MAT4, typeParselet(Type.MAT4));
	pratt.literal(TokenKind.VEC2, typeParselet(Type.VEC2));
	pratt.literal(TokenKind.VEC3, typeParselet(Type.VEC3));
	pratt.literal(TokenKind.VEC4, typeParselet(Type.VEC4));
	pratt.literal(TokenKind.VOID, typeParselet(Type.VOID));
	pratt.prefix(TokenKind.COMPLEMENT, Precedence.UNARY_PREFIX, invalidUnaryOperator);
	pratt.prefix(TokenKind.DECREMENT, Precedence.UNARY_PREFIX, unaryPrefix(NodeKind.PREFIX_DECREMENT));
	pratt.prefix(TokenKind.INCREMENT, Precedence.UNARY_PREFIX, unaryPrefix(NodeKind.PREFIX_INCREMENT));
	pratt.prefix(TokenKind.MINUS, Precedence.UNARY_PREFIX, unaryPrefix(NodeKind.NEGATIVE));
	pratt.prefix(TokenKind.NOT, Precedence.UNARY_PREFIX, unaryPrefix(NodeKind.NOT));
	pratt.prefix(TokenKind.PLUS, Precedence.UNARY_PREFIX, unaryPrefix(NodeKind.POSITIVE));
	pratt.postfix(TokenKind.DECREMENT, Precedence.UNARY_POSTFIX, unaryPostfix(NodeKind.POSTFIX_DECREMENT));
	pratt.postfix(TokenKind.INCREMENT, Precedence.UNARY_POSTFIX, unaryPostfix(NodeKind.POSTFIX_INCREMENT));
	pratt.infix(TokenKind.DIVIDE, Precedence.MULTIPLY, binaryParselet(NodeKind.DIVIDE));
	pratt.infix(TokenKind.EQUAL, Precedence.COMPARE, binaryParselet(NodeKind.EQUAL));
	pratt.infix(TokenKind.GREATER_THAN, Precedence.COMPARE, binaryParselet(NodeKind.GREATER_THAN));
	pratt.infix(TokenKind.GREATER_THAN_OR_EQUAL, Precedence.COMPARE, binaryParselet(NodeKind.GREATER_THAN_OR_EQUAL));
	pratt.infix(TokenKind.LESS_THAN, Precedence.COMPARE, binaryParselet(NodeKind.LESS_THAN));
	pratt.infix(TokenKind.LESS_THAN_OR_EQUAL, Precedence.COMPARE, binaryParselet(NodeKind.LESS_THAN_OR_EQUAL));
	pratt.infix(TokenKind.MINUS, Precedence.ADD, binaryParselet(NodeKind.SUBTRACT));
	pratt.infix(TokenKind.MULTIPLY, Precedence.MULTIPLY, binaryParselet(NodeKind.MULTIPLY));
	pratt.infix(TokenKind.NOT_EQUAL, Precedence.COMPARE, binaryParselet(NodeKind.NOT_EQUAL));
	pratt.infix(TokenKind.PLUS, Precedence.ADD, binaryParselet(NodeKind.ADD));
	pratt.infix(TokenKind.REMAINDER, Precedence.MULTIPLY, invalidBinaryOperator);
	pratt.infix(TokenKind.SHIFT_LEFT, Precedence.SHIFT, invalidBinaryOperator);
	pratt.infix(TokenKind.SHIFT_RIGHT, Precedence.SHIFT, invalidBinaryOperator);
	pratt.infix(TokenKind.LOGICAL_OR, Precedence.LOGICAL_OR, binaryParselet(NodeKind.LOGICAL_OR));
	pratt.infix(TokenKind.LOGICAL_XOR, Precedence.LOGICAL_XOR, binaryParselet(NodeKind.LOGICAL_XOR));
	pratt.infix(TokenKind.LOGICAL_AND, Precedence.LOGICAL_AND, binaryParselet(NodeKind.LOGICAL_AND));
	pratt.infix(TokenKind.BITWISE_AND, Precedence.BITWISE_AND, invalidBinaryOperator);
	pratt.infix(TokenKind.BITWISE_OR, Precedence.BITWISE_OR, invalidBinaryOperator);
	pratt.infix(TokenKind.BITWISE_XOR, Precedence.BITWISE_XOR, invalidBinaryOperator);
	pratt.infixRight(TokenKind.ASSIGN, Precedence.ASSIGN, binaryParselet(NodeKind.ASSIGN));
	pratt.infixRight(TokenKind.ASSIGN_ADD, Precedence.ASSIGN, binaryParselet(NodeKind.ASSIGN_ADD));
	pratt.infixRight(TokenKind.ASSIGN_BITWISE_AND, Precedence.ASSIGN, invalidBinaryOperator);
	pratt.infixRight(TokenKind.ASSIGN_BITWISE_OR, Precedence.ASSIGN, invalidBinaryOperator);
	pratt.infixRight(TokenKind.ASSIGN_BITWISE_XOR, Precedence.ASSIGN, invalidBinaryOperator);
	pratt.infixRight(TokenKind.ASSIGN_DIVIDE, Precedence.ASSIGN, binaryParselet(NodeKind.ASSIGN_DIVIDE));
	pratt.infixRight(TokenKind.ASSIGN_MULTIPLY, Precedence.ASSIGN, binaryParselet(NodeKind.ASSIGN_MULTIPLY));
	pratt.infixRight(TokenKind.ASSIGN_REMAINDER, Precedence.ASSIGN, invalidBinaryOperator);
	pratt.infixRight(TokenKind.ASSIGN_SHIFT_LEFT, Precedence.ASSIGN, invalidBinaryOperator);
	pratt.infixRight(TokenKind.ASSIGN_SHIFT_RIGHT, Precedence.ASSIGN, invalidBinaryOperator);
	pratt.infixRight(TokenKind.ASSIGN_SUBTRACT, Precedence.ASSIGN, binaryParselet(NodeKind.ASSIGN_SUBTRACT));

	// Name
	pratt.literal(TokenKind.IDENTIFIER, (context: ParserContext, token: Token) => {
		let name = token.range.toString();
		let symbol = context.scope().find(name);

		if (symbol === null) {
			context.log.syntaxErrorBadSymbolReference(token.range);
			return Node.createParseError().withRange(token.range);
		}

		// Check extension usage
		if (symbol.requiredExtension !== null && context.compilationData.extensionBehavior(symbol.requiredExtension) === ExtensionBehavior.DISABLE) {
			context.log.syntaxErrorDisabledExtension(token.range, name, symbol.requiredExtension);
		}

		symbol.useCount = symbol.useCount + 1;
		return (symbol.isStruct() ? Node.createType(symbol.resolvedType()) : Node.createName(symbol)).withRange(token.range);
	});

	// Sequence
	pratt.infix(TokenKind.COMMA, Precedence.COMMA, (context: ParserContext, left: Node, token: Token, right: Node) => {
		if (left.kind !== NodeKind.SEQUENCE) {
			left = Node.createSequence().appendChild(left).withRange(left.range);
		}

		left.appendChild(right);
		return left.withRange(context.spanSince(left.range));
	});

	// Dot
	pratt.parselet(TokenKind.DOT, Precedence.MEMBER).infix = (context: ParserContext, left: Node) => {
		let dot = context.current().range;
		context.next();
		let name = context.current().range;

		if (!context.expect(TokenKind.IDENTIFIER)) {
			return Node.createDot(left, '').withRange(context.spanSince(left.range)).withInternalRange(dot.rangeAtEnd());
		}

		return Node.createDot(left, name.toString()).withRange(context.spanSince(left.range)).withInternalRange(name);
	};

	// Group
	pratt.parselet(TokenKind.LEFT_PARENTHESIS, Precedence.LOWEST).prefix = (context: ParserContext) => {
		let token = context.next();
		let value = pratt.parse(context, Precedence.LOWEST);

		if (value === null || !context.expect(TokenKind.RIGHT_PARENTHESIS)) {
			return Node.createParseError().withRange(context.spanSince(token.range));
		}

		return value.withRange(context.spanSince(token.range));
	};

	// Call
	pratt.parselet(TokenKind.LEFT_PARENTHESIS, Precedence.UNARY_POSTFIX).infix = (context: ParserContext, left: Node) => {
		let token = context.next();
		let node = Node.createCall(left);

		if (!parseCommaSeparatedList(context, node, TokenKind.RIGHT_PARENTHESIS)) {
			return Node.createParseError().withRange(context.spanSince(token.range));
		}

		return node.withRange(context.spanSince(left.range)).withInternalRange(context.spanSince(token.range));
	};

	// Index
	pratt.parselet(TokenKind.LEFT_BRACKET, Precedence.MEMBER).infix = (context: ParserContext, left: Node) => {
		let token = context.next();

		// The "[]" syntax isn't valid but skip over it and recover
		if (context.peek(TokenKind.RIGHT_BRACKET)) {
			context.unexpectedToken();
			context.next();
			return Node.createParseError().withRange(context.spanSince(token.range));
		}

		let value = pratt.parse(context, Precedence.LOWEST);

		if (value === null || !context.expect(TokenKind.RIGHT_BRACKET)) {
			return Node.createParseError().withRange(context.spanSince(token.range));
		}

		return Node.createBinary(NodeKind.INDEX, left, value).withRange(context.spanSince(left.range)).withInternalRange(context.spanSince(token.range));
	};

	// Hook
	pratt.parselet(TokenKind.QUESTION, Precedence.ASSIGN).infix = (context: ParserContext, left: Node) => {
		let token = context.next();
		let middle = pratt.parse(context, Precedence.COMMA);

		if (middle === null || !context.expect(TokenKind.COLON)) {
			return Node.createParseError().withRange(context.spanSince(token.range));
		}

		let right = pratt.parse(context, Precedence.COMMA);

		if (right === null) {
			return Node.createParseError().withRange(context.spanSince(token.range));
		}

		return Node.createHook(left, middle, right).withRange(context.spanSince(left.range));
	};
	return pratt;
}

export function parseCommaSeparatedList(context: ParserContext, parent: Node, stop: TokenKind): boolean {
	let isFirst = true;

	while (!context.eat(stop)) {
		if (!isFirst) {
			context.expect(TokenKind.COMMA);
		}

		let firstToken = context.current();
		let value = pratt.parse(context, Precedence.COMMA);

		if (value !== null) {
			parent.appendChild(value);
		} else {
			// Recover from errors due to partially-typed calls
			parent.appendChild(Node.createParseError().withRange(context.spanSince(firstToken.range)));

			if (context.current().kind !== TokenKind.COMMA && context.current().kind !== stop) {
				return false;
			}
		}

		isFirst = false;
	}

	return true;
}

export function parseDoWhile(context: ParserContext): Node {
	let token = context.next();
	context.pushScope(new Scope(ScopeKind.LOOP, context.scope()));
	let body = parseStatement(context, VariableKind.LOCAL);

	if (body === null || !context.expect(TokenKind.WHILE) || !context.expect(TokenKind.LEFT_PARENTHESIS)) {
		return null;
	}

	let test = pratt.parse(context, Precedence.LOWEST);

	if (test === null) {
		return null;
	}

	if (!context.expect(TokenKind.RIGHT_PARENTHESIS)) {
		return null;
	}

	context.popScope();
	return checkForSemicolon(context, token.range, Node.createDoWhile(body, test));
}

export function parseExportOrImport(context: ParserContext): Node {
	let token = context.next();
	let old = context.flags;
	context.flags |= token.kind === TokenKind.EXPORT ? SymbolFlags.EXPORTED : SymbolFlags.IMPORTED;

	// Parse a modifier block
	if (context.eat(TokenKind.LEFT_BRACE)) {
		let node = Node.createModifierBlock();

		if (!parseStatements(context, node, VariableKind.GLOBAL) || !context.expect(TokenKind.RIGHT_BRACE)) {
			return null;
		}

		context.flags = old;
		return node.withRange(context.spanSince(token.range));
	}

	// Just parse a single statement
	let statement = parseStatement(context, VariableKind.GLOBAL);

	if (statement === null) {
		return null;
	}

	context.flags = old;
	return statement;
}

export function parseExtension(context: ParserContext): Node {
	let token = context.next();
	let range = context.current().range;

	if (!context.expect(TokenKind.IDENTIFIER)) {
		return null;
	}

	let name = range.toString();

	// Parse an extension block (a non-standard addition)
	if (context.eat(TokenKind.LEFT_BRACE)) {
		if (!context.compilationData.currentExtensions.has(name)) {
			StringMap_set2(context.compilationData.currentExtensions, name, ExtensionBehavior.DEFAULT); // Silence warnings about this name
		}

		let block = Node.createModifierBlock();

		if (!parseStatements(context, block, VariableKind.GLOBAL) || !context.expect(TokenKind.RIGHT_BRACE)) {
			return null;
		}

		for (let child = block.firstChild(); child !== null; child = child.nextSibling()) {
			if (child.kind === NodeKind.VARIABLES) {
				for (let variable = child.variablesType().nextSibling(); variable !== null; variable = variable.nextSibling()) {
					variable.symbol.requiredExtension = name;
				}
			} else if (child.symbol !== null) {
				child.symbol.requiredExtension = name;
			}
		}

		return block.withRange(context.spanSince(token.range));
	}

	// Warn about typos
	if (!_knownWebGLExtensions.has(name) && !context.compilationData.currentExtensions.has(name)) {
		context.log.syntaxWarningUnknownExtension(range, name);
	}

	// Parse a regular extension pragma
	if (!context.expect(TokenKind.COLON)) {
		return null;
	}

	let text = context.current().range.toString();

	if (!_extensionBehaviors.has(text)) {
		context.unexpectedToken();
		return null;
	}

	context.next();

	// Activate or deactivate the extension
	let behavior = StringMap_get11(_extensionBehaviors, text);
	StringMap_set2(context.compilationData.currentExtensions, name, behavior);
	return Node.createExtension(name, behavior).withRange(context.spanSince(token.range)).withInternalRange(range);
}

export function parseFor(context: ParserContext): Node {
	let token = context.next();
	context.pushScope(new Scope(ScopeKind.LOOP, context.scope()));

	if (!context.expect(TokenKind.LEFT_PARENTHESIS)) {
		return null;
	}

	// Setup
	let setup: Node = null;

	if (!context.eat(TokenKind.SEMICOLON)) {
		// Check for a type
		let comments = parseLeadingComments(context);
		let flags = parseFlags(context, VariableKind.LOCAL);
		let type: Node = null;

		if (flags !== 0) {
			type = parseType(context, ParseTypeMode.REPORT_ERRORS);

			if (type === null) {
				return null;
			}
		} else {
			type = parseType(context, ParseTypeMode.IGNORE_ERRORS);
		}

		// Try to parse a variable
		if (type !== null) {
			setup = parseAfterType(context, token.range, flags, type, Allow.AVOID_FUNCTIONS, comments);

			if (setup === null) {
				return null;
			}
		} else {
			setup = pratt.parse(context, Precedence.LOWEST);

			if (setup === null) {
				return null;
			}

			if (!context.expect(TokenKind.SEMICOLON)) {
				return null;
			}
		}
	}

	// Test
	let test: Node = null;

	if (!context.eat(TokenKind.SEMICOLON)) {
		test = pratt.parse(context, Precedence.LOWEST);

		if (test === null) {
			return null;
		}

		if (!context.expect(TokenKind.SEMICOLON)) {
			return null;
		}
	}

	// Update
	let update: Node = null;

	if (!context.eat(TokenKind.RIGHT_PARENTHESIS)) {
		update = pratt.parse(context, Precedence.LOWEST);

		if (update === null) {
			return null;
		}

		if (!context.expect(TokenKind.RIGHT_PARENTHESIS)) {
			return null;
		}
	}

	// Body
	let body = parseStatement(context, VariableKind.LOCAL);

	if (body === null) {
		return null;
	}

	context.popScope();
	return Node.createFor(setup, test, update, body).withRange(context.spanSince(token.range));
}

export function parseIf(context: ParserContext): Node {
	let token = context.next();

	if (!context.expect(TokenKind.LEFT_PARENTHESIS)) {
		return null;
	}

	let firstToken = context.current();
	let test = pratt.parse(context, Precedence.LOWEST);

	if (test === null) {
		test = Node.createParseError().withRange(context.spanSince(firstToken.range));
	}

	if (!context.expect(TokenKind.RIGHT_PARENTHESIS)) {
		return null;
	}

	let yes = parseStatement(context, VariableKind.LOCAL);

	if (yes === null) {
		return null;
	}

	let no: Node = null;

	if (context.eat(TokenKind.ELSE)) {
		no = parseStatement(context, VariableKind.LOCAL);

		if (no === null) {
			return null;
		}
	}

	return Node.createIf(test, yes, no).withRange(context.spanSince(token.range));
}

export function parseVersion(context: ParserContext): Node {
	let token = context.next();
	let range = context.current().range;

	if (!context.expect(TokenKind.INT_LITERAL)) {
		return null;
	}

	return Node.createVersion(range.toString() | 0).withRange(context.spanSince(token.range));
}

export function parseWhile(context: ParserContext): Node {
	let token = context.next();
	context.pushScope(new Scope(ScopeKind.LOOP, context.scope()));

	if (!context.expect(TokenKind.LEFT_PARENTHESIS)) {
		return null;
	}

	let firstToken = context.current();
	let test = pratt.parse(context, Precedence.LOWEST);

	if (test === null) {
		test = Node.createParseError().withRange(context.spanSince(firstToken.range));
	}

	if (!context.expect(TokenKind.RIGHT_PARENTHESIS)) {
		return null;
	}

	let body = parseStatement(context, VariableKind.LOCAL);

	if (body === null) {
		return null;
	}

	context.popScope();
	return Node.createWhile(test, body).withRange(context.spanSince(token.range));
}

export function parseReturn(context: ParserContext): Node {
	let token = context.next();
	let value: Node = null;

	if (!context.eat(TokenKind.SEMICOLON)) {
		let firstToken = context.current();
		value = pratt.parse(context, Precedence.LOWEST);

		if (value === null) {
			value = Node.createParseError().withRange(context.spanSince(firstToken.range));
		}

		context.expect(TokenKind.SEMICOLON);
	}

	return Node.createReturn(value).withRange(context.spanSince(token.range));
}

export function parsePrecision(context: ParserContext): Node {
	let token = context.next();
	let flag = 0 as SymbolFlags;

	switch (context.current().kind) {
		case TokenKind.LOWP: {
			flag = SymbolFlags.LOWP;
			break;
		}

		case TokenKind.MEDIUMP: {
			flag = SymbolFlags.MEDIUMP;
			break;
		}

		case TokenKind.HIGHP: {
			flag = SymbolFlags.HIGHP;
			break;
		}

		default: {
			context.unexpectedToken();
			return null;
		}
	}

	context.next();
	let type = parseType(context, ParseTypeMode.REPORT_ERRORS);

	if (type === null) {
		return null;
	}

	return checkForSemicolon(context, token.range, Node.createPrecision(flag, type));
}

export function parseStruct(context: ParserContext, flags: number, comments: Array<string>): Node {
	let name = context.current().range;

	if (!context.expect(TokenKind.IDENTIFIER)) {
		return null;
	}

	let symbol = new StructSymbol(context.compilationData.nextSymbolID(), name, name.toString(), new Scope(ScopeKind.STRUCT, context.scope()));
	symbol.flags |= context.flags | flags;
	symbol.comments = comments;

	if (!tryToDefineUniquelyInScope(context, symbol as _Symbol)) {
		return null;
	}

	let range = context.current().range;
	let block = Node.createStructBlock();
	let variables: Node = null;

	if (!context.expect(TokenKind.LEFT_BRACE)) {
		return null;
	}

	context.pushScope(symbol.scope);

	while (!context.peek(TokenKind.RIGHT_BRACE) && !context.peek(TokenKind.END_OF_FILE)) {
		let statement = parseStatement(context, VariableKind.STRUCT);

		if (statement === null) {
			return null;
		}

		if (statement.kind !== NodeKind.VARIABLES) {
			context.log.syntaxErrorInsideStruct(statement.range);
			continue;
		}

		block.appendChild(statement);

		for (let child = statement.variablesType().nextSibling(); child !== null; child = child.nextSibling()) {
			let variable = child.symbol.asVariable();
			symbol.variables.push(variable);

			if (variable.value() !== null) {
				context.log.syntaxErrorStructVariableInitializer(variable.value().range);
			}
		}
	}

	context.popScope();

	if (!context.expect(TokenKind.RIGHT_BRACE)) {
		return null;
	}

	block.withRange(context.spanSince(range));

	// Parse weird struct-variable hybrid things
	//
	//   struct S { int x; } y, z[2];
	//
	if (context.peek(TokenKind.IDENTIFIER)) {
		variables = parseVariables(0, Node.createType(symbol.resolvedType()), context.next().range, context, comments);

		if (variables === null) {
			return null;
		}
	} else {
		context.expect(TokenKind.SEMICOLON);
	}

	return Node.createStruct(symbol, block, variables);
}

export function checkForLoopAndSemicolon(context: ParserContext, range: Range, node: Node): Node {
	let found = false;

	for (let scope = context.scope(); scope !== null; scope = scope.parent) {
		if (scope.kind === ScopeKind.LOOP) {
			found = true;
			break;
		}
	}

	if (!found) {
		context.log.syntaxErrorOutsideLoop(range);
	}

	return checkForSemicolon(context, range, node);
}

export function checkForSemicolon(context: ParserContext, range: Range, node: Node): Node {
	context.expect(TokenKind.SEMICOLON);
	return node.withRange(context.spanSince(range));
}

export function parseAfterType(context: ParserContext, range: Range, flags: SymbolFlags, type: Node, allow: Allow, comments: Array<string>): Node {
	let name = context.current().range;

	if (flags === 0 && !context.peek(TokenKind.IDENTIFIER)) {
		let value = pratt.resume(context, Precedence.LOWEST, type);

		if (value === null) {
			return null;
		}

		return checkForSemicolon(context, range, Node.createExpression(value));
	}

	if (!context.expect(TokenKind.IDENTIFIER)) {
		return null;
	}

	if (context.eat(TokenKind.LEFT_PARENTHESIS)) {
		return parseFunction(flags, type, name, context, comments);
	}

	let variables = parseVariables(flags, type, name, context, comments);

	if (variables === null) {
		return null;
	}

	return variables.withRange(context.spanSince(range));
}

export function parseLeadingComments(context: ParserContext): Array<string> {
	let firstToken = context.current();
	let comments = firstToken.comments;

	if (comments === null) {
		return null;
	}

	let nextRangeStart = firstToken.range.start;
	let leadingComments: Array<string> = null;

	// Scan the comments backwards
	for (let i = comments.length - 1; i >= 0; i = i - 1) {
		let comment = List_get2(comments, i);

		// Count the newlines in between this token and the next token
		let whitespace = string_slice22(comment.source.contents, comment.end, nextRangeStart);
		let newlineCount = 0;

		for (let j = 0; j < whitespace.length; j = j + 1) {
			let c = string_get13(whitespace, j);

			if (c === 13 || c === 10) {
				newlineCount = newlineCount + 1;

				if (c === 13 && j + 1 < whitespace.length && string_get13(whitespace, j + 1) === 10) {
					j = j + 1;
				}
			}
		}

		// Don't count comments if there's a blank line in between the comment and the statement
		if (newlineCount > 1) {
			break;
		}

		// Otherwise, count this comment
		(leadingComments !== null ? leadingComments : (leadingComments = [])).push(comment.toString());
		nextRangeStart = comment.start;
	}

	if (leadingComments !== null) {
		leadingComments.reverse();
	}

	return leadingComments;
}

export function parseStatement(context: ParserContext, mode: VariableKind): Node {
	let token = context.current();

	switch (token.kind) {
		case TokenKind.BREAK: {
			return checkForLoopAndSemicolon(context, context.next().range, Node.createBreak());
		}

		case TokenKind.CONTINUE: {
			return checkForLoopAndSemicolon(context, context.next().range, Node.createContinue());
		}

		case TokenKind.DISCARD: {
			return checkForSemicolon(context, context.next().range, Node.createDiscard());
		}

		case TokenKind.DO: {
			return parseDoWhile(context);
		}

		case TokenKind.EXPORT:
		case TokenKind.IMPORT: {
			return parseExportOrImport(context);
		}

		case TokenKind.EXTENSION: {
			return parseExtension(context);
		}

		case TokenKind.FOR: {
			return parseFor(context);
		}

		case TokenKind.IF: {
			return parseIf(context);
		}

		case TokenKind.LEFT_BRACE: {
			return parseBlock(context);
		}

		case TokenKind.PRECISION: {
			return parsePrecision(context);
		}

		case TokenKind.RETURN: {
			return parseReturn(context);
		}

		case TokenKind.SEMICOLON: {
			return Node.createBlock().withRange(context.next().range);
		}

		case TokenKind.VERSION: {
			return parseVersion(context);
		}

		case TokenKind.WHILE: {
			return parseWhile(context);
		}
	}

	// Try to parse a variable or function
	let comments = parseLeadingComments(context);
	let flags = parseFlags(context, mode);
	let type: Node = null;

	if (context.eat(TokenKind.STRUCT)) {
		let struct = parseStruct(context, flags, comments);

		if (struct === null) {
			return null;
		}

		return struct.withRange(context.spanSince(token.range));
	}

	if (flags !== 0) {
		type = parseType(context, ParseTypeMode.REPORT_ERRORS);

		if (type === null) {
			return null;
		}
	} else {
		type = parseType(context, ParseTypeMode.IGNORE_ERRORS);
	}

	if (type !== null) {
		return parseAfterType(context, token.range, flags, type, Allow.ALLOW_FUNCTIONS, comments);
	}

	// Parse an expression
	let value = pratt.parse(context, Precedence.LOWEST);

	if (value === null) {
		return null;
	}

	return checkForSemicolon(context, token.range, Node.createExpression(value));
}

export function checkStatementLocation(context: ParserContext, node: Node): void {
	if (node.kind === NodeKind.VARIABLES || node.kind === NodeKind.STRUCT) {
		return;
	}

	let isOutsideFunction = context.scope().kind === ScopeKind.GLOBAL || context.scope().kind === ScopeKind.STRUCT;
	let shouldBeOutsideFunction = node.kind === NodeKind.EXTENSION || node.kind === NodeKind.FUNCTION || node.kind === NodeKind.PRECISION || node.kind === NodeKind.VERSION;

	if (shouldBeOutsideFunction && !isOutsideFunction) {
		context.log.syntaxErrorInsideFunction(node.range);
	} else if (!shouldBeOutsideFunction && isOutsideFunction) {
		context.log.syntaxErrorOutsideFunction(node.range);
	}
}

export function parseInclude(context: ParserContext, parent: Node): boolean {
	// See if there is a string literal
	let range = context.current().range;

	if (!context.expect(TokenKind.STRING_LITERAL)) {
		return false;
	}

	// Decode the escapes
	let path: string = null;

	try {
		path = JSON.parse(range.toString());
	} catch {
		context.log.syntaxErrorInvalidString(range);
		return false;
	}

	// Must have access to the file system
	let fileAccess = context.compilationData.fileAccess;

	if (fileAccess === null) {
		context.log.semanticErrorIncludeWithoutFileAccess(range);
		return false;
	}

	// Must be able to read the file
	let source = fileAccess(path, range.source.name);

	if (source === null) {
		context.log.semanticErrorIncludeBadPath(range, path);
		return false;
	}

	if (context.processedIncludes.has(source.name)) {
		// We've already processed this include; no need to do it again
		return true;
	}

	StringMap_set2(context.processedIncludes, source.name, true);

	// Track the included file for jump-to-file in the IDE
	context.includes.push(new Include(range, source.entireRange()));

	// Parse the file and insert it into the parent
	let tokens = tokenize(context.log, source, TokenPurpose.COMPILE);
	let nestedContext = new ParserContext(context.log, tokens, context.compilationData, context.resolver, context.processedIncludes);
	nestedContext.pushScope(context.scope());

	if (!parseStatements(nestedContext, parent, VariableKind.GLOBAL) || !nestedContext.expect(TokenKind.END_OF_FILE)) {
		return false;
	}

	return true;
}

export function parseBlock(context: ParserContext): Node {
	let token = context.current();
	let block = Node.createBlock();
	context.pushScope(new Scope(ScopeKind.LOCAL, context.scope()));

	if (!context.expect(TokenKind.LEFT_BRACE) || !parseStatements(context, block, VariableKind.LOCAL) || !context.expect(TokenKind.RIGHT_BRACE)) {
		return null;
	}

	context.popScope();
	return block.withRange(context.spanSince(token.range));
}

export function parseFlags(context: ParserContext, mode: VariableKind): SymbolFlags {
	let flags = 0 as SymbolFlags;

	while (true) {
		let kind = context.current().kind;

		switch (kind) {
			case TokenKind.ATTRIBUTE: {
				flags |= SymbolFlags.ATTRIBUTE;
				break;
			}

			case TokenKind.CONST: {
				flags |= SymbolFlags.CONST;
				break;
			}

			case TokenKind.HIGHP: {
				flags |= SymbolFlags.HIGHP;
				break;
			}

			case TokenKind.IN: {
				flags |= SymbolFlags.IN;
				break;
			}

			case TokenKind.INOUT: {
				flags |= SymbolFlags.INOUT;
				break;
			}

			case TokenKind.LOWP: {
				flags |= SymbolFlags.LOWP;
				break;
			}

			case TokenKind.MEDIUMP: {
				flags |= SymbolFlags.MEDIUMP;
				break;
			}

			case TokenKind.OUT: {
				flags |= SymbolFlags.OUT;
				break;
			}

			case TokenKind.UNIFORM: {
				flags |= SymbolFlags.UNIFORM;
				break;
			}

			case TokenKind.VARYING: {
				flags |= SymbolFlags.VARYING;
				break;
			}

			default: {
				return flags;
			}
		}

		if (
			(mode === VariableKind.ARGUMENT && (kind === TokenKind.ATTRIBUTE || kind === TokenKind.UNIFORM || kind === TokenKind.VARYING)) ||
			(mode === VariableKind.STRUCT && kind !== TokenKind.LOWP && kind !== TokenKind.MEDIUMP && kind !== TokenKind.HIGHP) ||
			(mode !== VariableKind.ARGUMENT && (kind === TokenKind.IN || kind === TokenKind.OUT || kind === TokenKind.INOUT))
		) {
			context.log.syntaxErrorBadQualifier(context.current().range);
		}

		context.next();
	}
}

export function parseType(context: ParserContext, mode: ParseTypeMode): Node {
	let token = context.current();
	let type: Type = null;

	switch (token.kind) {
		case TokenKind.BOOL: {
			type = Type.BOOL;
			break;
		}

		case TokenKind.BVEC2: {
			type = Type.BVEC2;
			break;
		}

		case TokenKind.BVEC3: {
			type = Type.BVEC3;
			break;
		}

		case TokenKind.BVEC4: {
			type = Type.BVEC4;
			break;
		}

		case TokenKind.FLOAT: {
			type = Type.FLOAT;
			break;
		}

		case TokenKind.INT: {
			type = Type.INT;
			break;
		}

		case TokenKind.IVEC2: {
			type = Type.IVEC2;
			break;
		}

		case TokenKind.IVEC3: {
			type = Type.IVEC3;
			break;
		}

		case TokenKind.IVEC4: {
			type = Type.IVEC4;
			break;
		}

		case TokenKind.MAT2: {
			type = Type.MAT2;
			break;
		}

		case TokenKind.MAT3: {
			type = Type.MAT3;
			break;
		}

		case TokenKind.MAT4: {
			type = Type.MAT4;
			break;
		}

		case TokenKind.SAMPLER2D: {
			type = Type.SAMPLER2D;
			break;
		}

		case TokenKind.SAMPLERCUBE: {
			type = Type.SAMPLERCUBE;
			break;
		}

		case TokenKind.VEC2: {
			type = Type.VEC2;
			break;
		}

		case TokenKind.VEC3: {
			type = Type.VEC3;
			break;
		}

		case TokenKind.VEC4: {
			type = Type.VEC4;
			break;
		}

		case TokenKind.VOID: {
			type = Type.VOID;
			break;
		}

		case TokenKind.IDENTIFIER: {
			let symbol = context.scope().find(token.range.toString());

			if (symbol === null || !symbol.isStruct()) {
				if (mode === ParseTypeMode.REPORT_ERRORS) {
					context.unexpectedToken();
				}

				return null;
			}

			type = symbol.resolvedType();
			break;
		}

		default: {
			if (mode === ParseTypeMode.REPORT_ERRORS) {
				context.unexpectedToken();
			}

			return null;
		}
	}

	context.next();
	return Node.createType(type).withRange(context.spanSince(token.range));
}

export function parseFunction(flags: SymbolFlags, type: Node, name: Range, context: ParserContext, comments: Array<string>): Node {
	let originalScope = context.scope();
	let _function = new FunctionSymbol(context.compilationData.nextSymbolID(), name, name.toString(), new Scope(ScopeKind.FUNCTION, originalScope));
	_function.flags |= context.flags | flags | (_function.name === 'main' ? SymbolFlags.EXPORTED : (0 as SymbolFlags));
	_function.comments = comments;
	_function.returnType = type;
	context.pushScope(_function.scope);

	// Takes no arguments
	if (context.eat(TokenKind.VOID)) {
		if (!context.expect(TokenKind.RIGHT_PARENTHESIS)) {
			return null;
		}
	}

	// Takes arguments
	else if (!context.eat(TokenKind.RIGHT_PARENTHESIS)) {
		while (true) {
			// Parse leading flags
			let argumentFlags = parseFlags(context, VariableKind.ARGUMENT);

			// Parse the type
			let argumentType = parseType(context, ParseTypeMode.REPORT_ERRORS);

			if (argumentType === null) {
				return null;
			}

			// Parse the identifier
			let argumentName = context.current().range;

			if (!context.expect(TokenKind.IDENTIFIER)) {
				return null;
			}

			// Create the argument
			let argument = new VariableSymbol(context.compilationData.nextSymbolID(), argumentName, argumentName.toString(), context.scope(), VariableKind.ARGUMENT);
			argument.flags |= argumentFlags;
			argument.type = argumentType;
			_function._arguments.push(argument);
			tryToDefineUniquelyInScope(context, argument as _Symbol);

			// Array size
			if (!parseArraySize(context, argument)) {
				return null;
			}

			// Parse another argument?
			if (!context.eat(TokenKind.COMMA)) {
				break;
			}
		}

		if (!context.expect(TokenKind.RIGHT_PARENTHESIS)) {
			return null;
		}
	}

	let previous = StringMap_get3(originalScope.symbols, name.toString(), null);
	let hasBlock = !context.eat(TokenKind.SEMICOLON);

	// Merge adjacent function symbols to support overloading
	if (previous === null) {
		originalScope.define(_function as _Symbol);
	} else if (previous.isFunction()) {
		for (let link = previous.asFunction(); link !== null; link = link.previousOverload) {
			if (!link.hasSameArgumentTypesAs(_function)) {
				continue;
			}

			// Overloading by return type is not allowed
			if (link.returnType.resolvedType !== _function.returnType.resolvedType) {
				context.log.syntaxErrorDifferentReturnType(
					_function.returnType.range,
					_function.name,
					_function.returnType.resolvedType,
					link.returnType.resolvedType,
					link.returnType.range
				);
			}

			// Defining a function more than once is not allowed
			else if (link.block !== null || !hasBlock) {
				context.log.syntaxErrorDuplicateSymbolDefinition(_function.range, link.range);
			}

			// Merge the function with its forward declaration
			else {
				assert(link.sibling === null);
				assert(_function.sibling === null);
				link.sibling = _function;
				_function.sibling = link;
				_function.flags |= link.flags;
				link.flags = _function.flags;
			}

			break;
		}

		// Use a singly-linked list to store the function overloads
		_function.previousOverload = previous.asFunction();
		originalScope.redefine(_function as _Symbol);
	} else {
		context.log.syntaxErrorDuplicateSymbolDefinition(name, previous.range);
		return null;
	}

	if (hasBlock) {
		let old = context.flags;
		context.flags &= ~(SymbolFlags.EXPORTED | SymbolFlags.IMPORTED);
		_function.block = parseBlock(context);
		context.flags &= old;

		if (_function.block === null) {
			return null;
		}
	}

	context.popScope();
	return Node.createFunction(_function).withRange(context.spanSince(type.range));
}

export function parseArraySize(context: ParserContext, variable: VariableSymbol): boolean {
	let token = context.current();

	if (context.eat(TokenKind.LEFT_BRACKET)) {
		// The "[]" syntax isn't valid but skip over it and recover
		if (context.eat(TokenKind.RIGHT_BRACKET)) {
			context.log.syntaxErrorMissingArraySize(context.spanSince(token.range));
			return true;
		}

		variable.arrayCount = pratt.parse(context, Precedence.LOWEST);

		if (variable.arrayCount === null || !context.expect(TokenKind.RIGHT_BRACKET)) {
			return false;
		}

		// The array size must be resolved immediately
		let count = 0;
		context.resolver.resolveNode(variable.arrayCount);
		context.resolver.checkConversion(variable.arrayCount, Type.INT);

		if (variable.arrayCount.resolvedType !== Type.ERROR) {
			let folded = fold(variable.arrayCount);

			if (folded === null) {
				context.log.syntaxErrorConstantRequired(variable.arrayCount.range);
			} else if (folded.kind === NodeKind.INT) {
				let value = folded.asInt();

				if (value < 1) {
					context.log.syntaxErrorInvalidArraySize(variable.arrayCount.range, value);
				} else {
					count = value;
				}
			}
		}

		// Multidimensional arrays are not supported
		while (context.peek(TokenKind.LEFT_BRACKET)) {
			token = context.next();

			if ((!context.peek(TokenKind.RIGHT_BRACKET) && pratt.parse(context, Precedence.LOWEST) === null) || !context.expect(TokenKind.RIGHT_BRACKET)) {
				return false;
			}

			context.log.syntaxErrorMultidimensionalArray(context.spanSince(token.range));
		}

		variable.type = Node.createType(variable.type.resolvedType.arrayType(count)).withRange(variable.type.range);
	}

	return true;
}

export function parseVariables(flags: number, type: Node, name: Range, context: ParserContext, comments: Array<string>): Node {
	let variables = Node.createVariables(context.flags | flags, type);

	while (true) {
		let symbol = new VariableSymbol(
			context.compilationData.nextSymbolID(),
			name,
			name.toString(),
			context.scope(),
			context.scope().kind === ScopeKind.GLOBAL ? VariableKind.GLOBAL : context.scope().kind === ScopeKind.STRUCT ? VariableKind.STRUCT : VariableKind.LOCAL
		);
		symbol.flags |= context.flags | flags;
		symbol.comments = comments;
		symbol.type = type;

		// Array size
		if (!parseArraySize(context, symbol)) {
			return null;
		}

		// Initial value
		let assign = context.current().range;
		let value: Node = null;

		if (context.eat(TokenKind.ASSIGN)) {
			let firstToken = context.current();
			value = pratt.parse(context, Precedence.COMMA);

			if (value === null) {
				value = Node.createParseError().withRange(context.spanSince(firstToken.range));
			}
		} else {
			assign = null;
		}

		// Constants must be resolved immediately
		let variable = Node.createVariable(symbol, value).withRange(context.spanSince(symbol.range)).withInternalRange(assign);
		symbol.node = variable;

		if (symbol.isConst()) {
			context.resolver.resolveNode(variable);
		}

		variables.appendChild(variable);
		tryToDefineUniquelyInScope(context, symbol as _Symbol);

		// Are there more variables in this statement?
		if (!context.eat(TokenKind.COMMA)) {
			context.expect(TokenKind.SEMICOLON);
			return variables;
		}

		name = context.current().range;

		if (!context.expect(TokenKind.IDENTIFIER)) {
			return null;
		}
	}
}

export function tryToDefineUniquelyInScope(context: ParserContext, symbol: _Symbol): boolean {
	let previous = StringMap_get3(context.scope().symbols, symbol.name, null);

	if (previous !== null) {
		context.log.syntaxErrorDuplicateSymbolDefinition(symbol.range, previous.range);
		return false;
	}

	context.scope().define(symbol);
	return true;
}

export function parseStatements(context: ParserContext, parent: Node, mode: VariableKind): boolean {
	while (!context.peek(TokenKind.END_OF_FILE) && !context.peek(TokenKind.RIGHT_BRACE)) {
		let includeRange = context.current().range;

		if (context.eat(TokenKind.INCLUDE)) {
			if (mode !== VariableKind.GLOBAL) {
				context.log.syntaxErrorIncludeOutsideGlobal(includeRange);
				context.eat(TokenKind.STRING_LITERAL);
				return false;
			}

			if (!parseInclude(context, parent)) {
				return false;
			}

			continue;
		}

		let statement = parseStatement(context, mode);

		if (statement === null) {
			return false;
		}

		// Extension blocks are temporary and don't exist in the parsed result
		if (statement.kind === NodeKind.MODIFIER_BLOCK) {
			while (statement.hasChildren()) {
				let child = statement.firstChild().remove();
				checkStatementLocation(context, child);
				parent.appendChild(child);
			}
		} else {
			checkStatementLocation(context, statement);
			parent.appendChild(statement);
		}
	}

	return true;
}

export function parse(log: Log, tokens: Array<Token>, global: Node, data: CompilerData, scope: Scope, resolver: Resolver): ParseResult {
	if (pratt === null) {
		pratt = createExpressionParser();
	}

	let processedIncludes = new Map();
	let context = new ParserContext(log, tokens, data, resolver, processedIncludes);
	context.pushScope(scope);

	if (parseStatements(context, global, VariableKind.GLOBAL)) {
		context.expect(TokenKind.END_OF_FILE);
	}

	return new ParseResult(context.includes);
}

export let pratt: Pratt = null;
export let _extensionBehaviors = StringMap_insert1(
	StringMap_insert1(
		StringMap_insert1(StringMap_insert1(new Map(), 'disable', ExtensionBehavior.DISABLE), 'enable', ExtensionBehavior.ENABLE),
		'require',
		ExtensionBehavior.REQUIRE
	),
	'warn',
	ExtensionBehavior.WARN
);

// From https://www.khronos.org/registry/webgl/extensions/
export let _knownWebGLExtensions = StringMap_insert1(
	StringMap_insert1(StringMap_insert1(StringMap_insert1(new Map(), 'GL_OES_standard_derivatives', 0), 'GL_EXT_frag_depth', 0), 'GL_EXT_draw_buffers', 0),
	'GL_EXT_shader_texture_lod',
	0
);