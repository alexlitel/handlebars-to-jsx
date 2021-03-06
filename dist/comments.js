"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createComment = void 0;
var Babel = require("@babel/types");
var createComment = function (statement) {
    var value = statement.value;
    var emptyExpression = Babel.jsxEmptyExpression();
    emptyExpression.innerComments = [{ type: 'CommentBlock', value: value }];
    return Babel.jsxExpressionContainer(emptyExpression);
};
exports.createComment = createComment;
