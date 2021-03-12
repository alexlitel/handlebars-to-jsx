"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertElement = exports.convertModifier = exports.createAttribute = exports.createFragment = exports.createElement = void 0;
var Babel = require("@babel/types");
var isSelfClosing = require("is-self-closing");
var convertHTMLAttribute = require("react-attr-converter");
var expressions_1 = require("./expressions");
var styles_1 = require("./styles");
/**
 * Create element
 *
 */
var createElement = function (mustacheStatement) {
    var blockNode = {};
    blockNode.type = 'ElementNode';
    blockNode.tag = mustacheStatement.path.original
        .split('-')
        .map(function (stringPart) { return stringPart.charAt(0).toUpperCase() + stringPart.slice(1); })
        .join('');
    blockNode.attributes = mustacheStatement.hash.pairs.map(function (item) {
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
    blockNode.selfClosing = true;
    blockNode.children = [];
    return exports.convertElement(blockNode);
};
exports.createElement = createElement;
/**
 * Creates JSX fragment
 */
var createFragment = function (children, attributes) {
    if (attributes === void 0) { attributes = []; }
    var fragmentMemberExpression = Babel.jsxMemberExpression(Babel.jsxIdentifier('React'), Babel.jsxIdentifier('Fragment'));
    var openingFragment = Babel.jsxOpeningElement(fragmentMemberExpression, attributes);
    var closingFragment = Babel.jsxClosingElement(fragmentMemberExpression);
    return Babel.jsxElement(openingFragment, closingFragment, children, false);
    // }
};
exports.createFragment = createFragment;
/**
 * Coverts AttrNode to JSXAttribute
 */
var createAttribute = function (attrNode) {
    // Unsupported attribute
    var reactAttrName = convertHTMLAttribute(attrNode.name);
    if (!/^[_\-A-z0-9]+$/.test(reactAttrName)) {
        return null;
    }
    var name = Babel.jsxIdentifier(reactAttrName);
    var value = attrNode.value;
    switch (value.type) {
        case 'TextNode': {
            if (reactAttrName === 'style') {
                var styleObjectExpression = styles_1.createStyleObject(value);
                return Babel.jsxAttribute(name, Babel.jsxExpressionContainer(styleObjectExpression));
            }
            return Babel.jsxAttribute(name, Babel.stringLiteral(value.chars));
        }
        case 'MustacheStatement': {
            return Babel.jsxAttribute(name, Babel.jsxExpressionContainer(expressions_1.resolveExpression(value.path)));
        }
        case 'ConcatStatement': {
            var expression = expressions_1.createConcat(value.parts);
            if (reactAttrName === 'style') {
                var styleObjectExpression = styles_1.createStyleObject(value);
                return Babel.jsxAttribute(name, Babel.jsxExpressionContainer(styleObjectExpression));
            }
            return Babel.jsxAttribute(name, Babel.jsxExpressionContainer(expression));
        }
        default: {
            throw new Error('Unexpected attribute value');
        }
    }
};
exports.createAttribute = createAttribute;
/**
 * Converts modifiers to attributes
 */
var convertModifier = function (modifier) {
    var modifierType = modifier.path.original;
    var attrName;
    if (modifierType === 'action') {
        attrName = Babel.jsxIdentifier('onClick');
        var _a = modifier.params.map(function (item) {
            var value = item.original || item.value;
            return typeof value === 'number' ? Babel.numericLiteral(value) : Babel.identifier(value);
        }), actionName = _a[0], actionArguments = _a.slice(1);
        if (actionArguments.length) {
            return Babel.jsxAttribute(attrName, Babel.jsxExpressionContainer(Babel.arrowFunctionExpression([], Babel.callExpression(actionName, actionArguments))));
        }
        return Babel.jsxAttribute(attrName, Babel.jsxExpressionContainer(actionName));
    }
    if (modifierType === 'bind-attr') {
        if (modifier.hash.pairs) {
            return modifier.hash.pairs.map(function (item) {
                var attrName = item.key;
                var attrValue = item.value.original;
                if (attrName === 'class') {
                    attrName = 'className';
                    attrValue = Babel.callExpression(Babel.identifier('clsx'), [styles_1.createClassNameObject(attrValue)]);
                }
                else {
                    attrValue = Babel.identifier(attrValue);
                }
                return Babel.jsxAttribute(Babel.jsxIdentifier(attrName), Babel.jsxExpressionContainer(attrValue));
            });
        }
    }
    return null;
};
exports.convertModifier = convertModifier;
/**
 * Converts ElementNode to JSXElement
 */
var convertElement = function (node) {
    var tagName = Babel.jsxIdentifier(node.tag);
    var attributes = node.attributes
        .map(function (item) { return exports.createAttribute(item); })
        .filter(Boolean);
    if (node.modifiers && node.modifiers.length) {
        var modifiers = node.modifiers.reduce(function (acc, item) { return acc.concat(exports.convertModifier(item)); }, []).filter(Boolean);
        attributes.push.apply(attributes, modifiers);
    }
    var isElementSelfClosing = node.selfClosing || isSelfClosing(node.tag);
    var children = expressions_1.createChildren(node.children).map(function (item) {
        if (item.type === 'MemberExpression' || item.type === 'Identifier') {
            return Babel.jsxExpressionContainer(item);
        }
        return item;
    });
    return Babel.jsxElement(Babel.jsxOpeningElement(tagName, attributes, isElementSelfClosing), Babel.jsxClosingElement(tagName), isElementSelfClosing ? [] : children, isElementSelfClosing);
};
exports.convertElement = convertElement;
