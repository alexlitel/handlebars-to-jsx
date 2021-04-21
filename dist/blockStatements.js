"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEachStatement = exports.createConditionStatement = exports.createBlockElement = exports.resolveBlockStatement = void 0;
var Babel = require("@babel/types");
var expressions_1 = require("./expressions");
var elements_1 = require("./elements");
var constants_1 = require("./constants");
/**
 * Resolves block type
 */
var resolveBlockStatement = function (blockStatement) {
    switch (blockStatement.path.original) {
        case 'if': {
            return exports.createConditionStatement(blockStatement, false);
        }
        case 'unless': {
            return exports.createConditionStatement(blockStatement, true);
        }
        case 'each': {
            return exports.createEachStatement(blockStatement);
        }
        default: {
            if (blockStatement && blockStatement.program.body) {
                return exports.createBlockElement(blockStatement);
            }
            throw new Error("Unexpected " + blockStatement.path.original + " statement");
        }
    }
};
exports.resolveBlockStatement = resolveBlockStatement;
var createBlockElement = function (blockStatement) {
    var blockNode = {};
    blockNode.type = 'ElementNode';
    blockNode.tag = blockStatement.path.original
        .split('-')
        .map(function (stringPart) { return stringPart.charAt(0).toUpperCase() + stringPart.slice(1); })
        .join('');
    blockNode.attributes = blockStatement.hash.pairs.map(function (item) {
        var attrNode = {
            type: 'AttrNode',
        };
        attrNode.name = item.key;
        attrNode.value = {
            type: item.value.type === 'StringLiteral' ? 'TextNode' : 'MustacheStatement',
            chars: String(item.value.original || ''),
            path: item.value,
        };
        return attrNode;
    });
    blockNode.selfClosing = false;
    blockNode.children = blockStatement.program.body;
    return elements_1.convertElement(blockNode);
};
exports.createBlockElement = createBlockElement;
/**
 * Creates condition statement
 */
var createConditionStatement = function (blockStatement, invertCondition) {
    var program = blockStatement.program, inverse = blockStatement.inverse;
    var boolCondSubject = Babel.callExpression(Babel.identifier('Boolean'), [expressions_1.resolveExpression(blockStatement.params[0])]);
    if (invertCondition) {
        boolCondSubject = Babel.unaryExpression('!', boolCondSubject);
    }
    var conditionBody = expressions_1.createRootChildren(program.body);
    if (conditionBody.type === 'JSXExpressionContainer') {
        conditionBody = conditionBody.expression;
    }
    if (inverse == null) {
        // Logical expression
        // {Boolean(variable) && <div />}
        // if (conditionBody.expression) {}
        return Babel.logicalExpression('&&', boolCondSubject, conditionBody);
    }
    else {
        var inverseBody = expressions_1.createRootChildren(inverse.body);
        if (inverseBody && inverseBody.type === 'JSXExpressionContainer') {
            inverseBody = inverseBody.expression;
        }
        // Ternary expression
        // {Boolean(variable) ? <div /> : <span />}
        return Babel.conditionalExpression(boolCondSubject, conditionBody, inverseBody);
    }
};
exports.createConditionStatement = createConditionStatement;
/**
 * Creates each block statement
 */
var createEachStatement = function (blockStatement) {
    var pathExpression = blockStatement.params[0];
    var iterator = expressions_1.appendToPath(expressions_1.createPath(pathExpression), Babel.identifier('map'));
    var mapCallbackChildren = expressions_1.createRootChildren(blockStatement.program.body);
    // If top-level child element is JS expression, wrap into fragment to add
    // the "key" attribute.
    var wrappedCallbackChildren = !Babel.isJSXElement(mapCallbackChildren)
        ? elements_1.createFragment([Babel.jsxExpressionContainer(mapCallbackChildren)])
        : mapCallbackChildren;
    // Adding the "key" attribute to child element
    wrappedCallbackChildren.openingElement.attributes.push(Babel.jsxAttribute(Babel.jsxIdentifier('key'), Babel.jsxExpressionContainer(Babel.identifier(constants_1.DEFAULT_KEY_NAME))));
    var mapCallback = Babel.arrowFunctionExpression([
        Babel.identifier(constants_1.DEFAULT_NAMESPACE_NAME),
        Babel.identifier(constants_1.DEFAULT_KEY_NAME),
    ], wrappedCallbackChildren);
    return Babel.callExpression(iterator, [mapCallback]);
};
exports.createEachStatement = createEachStatement;
