"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compile = void 0;
/* eslint-disable import/export */
var syntax_1 = require("@glimmer/syntax");
var generator_1 = require("@babel/generator");
var program_1 = require("./program");
function compile(code, options) {
    if (options === void 0) { options = true; }
    if (typeof options === 'boolean') {
        return compile(code, { isComponent: options });
    }
    var isComponent = !!options.isComponent;
    var isModule = !!options.isModule;
    var includeImport = !!options.includeImport && isModule;
    var glimmerProgram = syntax_1.preprocess(code);
    var babelProgram = program_1.createProgram(glimmerProgram, isComponent, isModule, includeImport);
    return generator_1.default(babelProgram).code;
}
exports.compile = compile;
