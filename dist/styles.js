"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClassNameObject = exports.createStyleObject = exports.camelizePropName = void 0;
var syntax_1 = require("@glimmer/syntax");
var Babel = require("@babel/types");
var expressions_1 = require("./expressions");
/**
 * Transforms "prop-name" to "propName"
 * @param propName
 */
var camelizePropName = function (propName) {
    return propName.replace(/-([a-z])/g, function (_, $1) { return $1.toUpperCase(); });
};
exports.camelizePropName = camelizePropName;
/**
 * Create AST tree of style object
 */
var createStyleObject = function (hbsStatement) {
    var rawHbsStatement = hbsStatement.type === "TextNode"
        ? hbsStatement.chars
        : syntax_1.print(hbsStatement).slice(1, -1);
    var objectProps = rawHbsStatement
        .split(";")
        .filter(function (item) { return item.length !== 0; })
        .map(function (cssRule) {
        var _a = cssRule
            .split(":")
            .map(function (str) { return str.trim(); }), rawKey = _a[0], rawValue = _a[1];
        var _b = [rawKey, rawValue].map(function (item) {
            return syntax_1.preprocess(item || "").body.filter(function (item) {
                return item.type === "MustacheStatement" || item.type === "TextNode";
            });
        }), hbsKey = _b[0], hbsValue = _b[1];
        var key = hbsKey.length === 1
            ? hbsKey[0].type === "TextNode"
                ? Babel.stringLiteral(exports.camelizePropName(hbsKey[0].chars)) // Capitalize key name
                : expressions_1.resolveStatement(hbsKey[0])
            : expressions_1.createConcat(hbsKey);
        var value = hbsValue.length === 1
            ? expressions_1.resolveStatement(hbsValue[0])
            : expressions_1.createConcat(hbsValue);
        var isComputed = hbsKey.length > 1;
        return Babel.objectProperty(key, value, isComputed);
    });
    return Babel.objectExpression(objectProps);
};
exports.createStyleObject = createStyleObject;
var resolveClassName = function (key) {
    return /^\w+$/.test(key) ? Babel.identifier(key) : Babel.stringLiteral(key);
};
var resolveClassNameInnerValue = function (value) { return value.startsWith("!")
    ? Babel.unaryExpression("!", Babel.identifier(value.slice(1)))
    : Babel.identifier(value); };
var resolveClassNameValue = function (value) {
    if (value.length === 1) {
        if (value[0] === true) {
            return Babel.booleanLiteral(true);
        }
        else {
            return resolveClassNameInnerValue(value[0]);
        }
    }
    else {
        return value.slice(2).reduce(function (acc, className) {
            return Babel.logicalExpression("||", acc, resolveClassNameInnerValue(className));
        }, Babel.logicalExpression("||", resolveClassNameInnerValue(value[0]), resolveClassNameInnerValue(value[1])));
    }
};
/**
 * Creates Babel Object expression from class names string
 * @param classNames
 */
var createClassNameObject = function (classNames) {
    var classNameMap = classNames
        .split(" ")
        .reduce(function (acc, className) {
        var _a = className.split(":"), value = _a[0], class1 = _a[1], class2 = _a[2];
        if (class1 && !acc[class1]) {
            acc[class1] = [];
        }
        if (class2 && !acc[class2]) {
            acc[class2] = [];
        }
        if (className === ":" + className.slice(1)) {
            acc[class1].push(true);
        }
        else if (className.includes("::") && class2) {
            acc[class2].push("!" + value);
        }
        else if (value && (class1 || class2)) {
            if (class1) {
                acc[class1].push(value);
            }
            if (class2) {
                acc[class2].push("!" + value);
            }
        }
        return acc;
    }, {});
    var objectProps = Object.entries(classNameMap).map(function (_a) {
        var key = _a[0], value = _a[1];
        return Babel.objectProperty(resolveClassName(key), resolveClassNameValue(value));
    });
    return Babel.objectExpression(objectProps);
};
exports.createClassNameObject = createClassNameObject;
