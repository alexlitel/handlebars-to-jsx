"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareJsxText = exports.createConcat = exports.createRootChildren = exports.createChildren = exports.prependToPath = exports.appendToPath = exports.createPath = exports.resolveExpression = exports.resolveElementChild = exports.resolveStatement = exports.resolveHelpers = exports.resolveMustacheStatement = void 0;
var Babel = require("@babel/types");
var elements_1 = require("./elements");
var blockStatements_1 = require("./blockStatements");
var comments_1 = require("./comments");
/**
 * Converts mustache statement to something parseable
 */
var resolveMustacheStatement = function (statement) {
    var statementPath = statement.path;
    var original = statementPath.original || '';
    var parts = statementPath.parts || [];
    if (statement.params && !!statement.params.length) {
        return exports.resolveHelpers(statement);
    }
    if (statementPath.type === 'PathExpression'
        && original.includes('-')
        && parts.length === 1) {
        return elements_1.createElement(statement);
    }
    return exports.resolveExpression(statement.path);
};
exports.resolveMustacheStatement = resolveMustacheStatement;
/**
 * Coerce helpers to inline functions
 */
var resolveHelpers = function (statement) {
    return Babel.jsxExpressionContainer(Babel.callExpression(Babel.identifier(statement.path.original), statement.params.map(function (item) {
        var value = item.original || item.value;
        return typeof value === 'number'
            ? Babel.numericLiteral(value)
            : Babel.identifier(value);
    })));
};
exports.resolveHelpers = resolveHelpers;
/**
 * Converts the Handlebars expression to NON-JSX JS-compatible expression.
 * Creates top-level expression or expression which need to wrap to JSX
 * expression container.
 */
var resolveStatement = function (statement) {
    switch (statement.type) {
        case 'ElementNode': {
            return elements_1.convertElement(statement);
        }
        case 'TextNode': {
            return Babel.stringLiteral(statement.chars);
        }
        case 'MustacheStatement': {
            return exports.resolveMustacheStatement(statement);
        }
        case 'BlockStatement': {
            return blockStatements_1.resolveBlockStatement(statement);
        }
        case 'MustacheCommentStatement':
        case 'CommentStatement': {
            throw new Error('Top level comments currently is not supported');
        }
        default: {
            throw new Error("Unexpected expression \"" + statement.type + "\"");
        }
    }
};
exports.resolveStatement = resolveStatement;
/**
 * Converts the Handlebars node to JSX-children-compatible child element.
 * Creates JSX expression or expression container with JS expression, to place
 * to children of a JSX element.
 */
var resolveElementChild = function (statement) {
    switch (statement.type) {
        case 'ElementNode': {
            return elements_1.convertElement(statement);
        }
        case 'TextNode': {
            return exports.prepareJsxText(statement.chars);
        }
        case 'MustacheCommentStatement':
        case 'CommentStatement': {
            return comments_1.createComment(statement);
        }
        case 'MustacheStatement': {
            return exports.resolveMustacheStatement(statement);
        }
        case 'BlockStatement': {
            if (!/(if|each|unless)/i.test(statement.path.original)) {
                return blockStatements_1.createBlockElement(statement);
            }
        }
        // If it expression, create a expression container
        // eslint-disable-next-line
        default: {
            return Babel.jsxExpressionContainer(exports.resolveStatement(statement));
        }
    }
};
exports.resolveElementChild = resolveElementChild;
/**
 * Converts Hbs expression to Babel expression
 */
var resolveExpression = function (expression) {
    switch (expression.type) {
        case 'PathExpression': {
            return exports.createPath(expression);
        }
        case 'BooleanLiteral': {
            return Babel.booleanLiteral(expression.value);
        }
        case 'NullLiteral': {
            return Babel.nullLiteral();
        }
        case 'NumberLiteral': {
            return Babel.numericLiteral(expression.value);
        }
        case 'StringLiteral': {
            return Babel.stringLiteral(expression.value);
        }
        case 'UndefinedLiteral': {
            return Babel.identifier('undefined');
        }
        default: {
            throw new Error('Unexpected mustache statement');
        }
    }
};
exports.resolveExpression = resolveExpression;
/**
 * Returns path to variable
 */
var createPath = function (pathExpression) {
    var parts = pathExpression.parts;
    if (parts.length === 0) {
        throw new Error('Unexpected empty expression parts');
    }
    // Start identifier
    var acc = Babel.identifier(parts[0]);
    for (var i = 1; i < parts.length; i++) {
        acc = exports.appendToPath(acc, Babel.identifier(parts[i]));
    }
    return acc;
};
exports.createPath = createPath;
/**
 * Appends item to path
 */
var appendToPath = function (path, append) { return Babel.memberExpression(path, append); };
exports.appendToPath = appendToPath;
/**
 * Prepends item to path
 */
var prependToPath = function (path, prepend) { return Babel.memberExpression(prepend, path); };
exports.prependToPath = prependToPath;
/**
 * Converts child statements of element to JSX-compatible expressions
 * @param body List of Glimmer statements
 */
var createChildren = function (body) {
    return body.reduce(function (acc, statement) {
        var child = exports.resolveElementChild(statement);
        return Array.isArray(child) ? __spreadArrays(acc, child) : __spreadArrays(acc, [child]);
    }, []);
};
exports.createChildren = createChildren;
/**
 * Converts root children
 */
var createRootChildren = function (body) {
    return body.length === 1
        ? exports.resolveStatement(body[0])
        : elements_1.createFragment(exports.createChildren(body));
};
exports.createRootChildren = createRootChildren;
/**
 * Creates attribute value concatenation
 */
var createConcat = function (parts) {
    return parts.reduce(function (acc, item) {
        if (acc == null) {
            return exports.resolveStatement(item);
        }
        return Babel.binaryExpression('+', acc, exports.resolveStatement(item));
    }, null);
};
exports.createConcat = createConcat;
/**
 * Escapes syntax chars in jsx text
 * @param text
 */
var prepareJsxText = function (text) {
    // Escape jsx syntax chars
    var parts = text.split(/(:?{|})/);
    if (parts.length === 1) {
        return Babel.jsxText(text);
    }
    return parts.map(function (item) {
        return item === '{' || item === '}'
            ? Babel.jsxExpressionContainer(Babel.stringLiteral(item))
            : Babel.jsxText(item);
    });
};
exports.prepareJsxText = prepareJsxText;
