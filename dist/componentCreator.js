"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createComponent = void 0;
var Babel = require("@babel/types");
/**
 * Creates arrow component
 */
var createComponent = function (body) {
    return Babel.arrowFunctionExpression([Babel.identifier('props')], body);
};
exports.createComponent = createComponent;
