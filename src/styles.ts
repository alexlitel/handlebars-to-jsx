import { AST as Glimmer, preprocess, print } from "@glimmer/syntax";
import * as Babel from "@babel/types";
import { parseExpression } from "@babel/parser";
import { createConcat, resolveStatement } from "./expressions";

type StylePropValue = (string | boolean)[]

/**
 * Transforms "prop-name" to "propName"
 * @param propName
 */
export const camelizePropName = (propName: string) =>
  propName.replace(/-([a-z])/g, (_, $1) => $1.toUpperCase());

/**
 * Create AST tree of style object
 */
export const createStyleObject = (
  hbsStatement: Glimmer.TextNode | Glimmer.ConcatStatement
): Babel.ObjectExpression => {
  const rawHbsStatement: string =
    hbsStatement.type === "TextNode"
      ? hbsStatement.chars
      : print(hbsStatement).slice(1, -1);

  const objectProps: Array<
    Babel.ObjectMethod | Babel.ObjectProperty | Babel.SpreadElement
  > = rawHbsStatement
    .split(";")
    .filter((item) => item.length !== 0)
    .map((cssRule) => {
      const [rawKey, rawValue]: (string | undefined)[] = cssRule
        .split(":")
        .map((str) => str.trim());

      const [hbsKey, hbsValue] = [rawKey, rawValue].map(
        (item) =>
          preprocess(item || "").body.filter(
            (item) =>
              item.type === "MustacheStatement" || item.type === "TextNode"
          ) as Array<Glimmer.TextNode | Glimmer.MustacheStatement>
      );

      const key =
        hbsKey.length === 1
          ? hbsKey[0].type === "TextNode"
            ? Babel.stringLiteral(
                camelizePropName((hbsKey[0] as Glimmer.TextNode).chars)
              ) // Capitalize key name
            : resolveStatement(hbsKey[0])
          : createConcat(hbsKey);

      const value =
        hbsValue.length === 1
          ? resolveStatement(hbsValue[0])
          : createConcat(hbsValue);
      const isComputed = hbsKey.length > 1;

      return Babel.objectProperty(key, value, isComputed);
    });

  return Babel.objectExpression(objectProps);
};

const resolveClassName = (
  key: string
): Babel.Identifier | Babel.StringLiteral =>
  /^\w+$/.test(key) ? Babel.identifier(key) : Babel.stringLiteral(key);

const resolveClassNameInnerValue = (
  value: string
): Babel.UnaryExpression | Babel.Identifier => value.startsWith("!")
    ? Babel.unaryExpression("!", Babel.identifier(value.slice(1)))
    : Babel.identifier(value);


const resolveClassNameValue = (
  value: StylePropValue
):
  | Babel.Identifier
  | Babel.UnaryExpression
  | Babel.BooleanLiteral
  | Babel.LogicalExpression => {
  if (value.length === 1) {
    if (value[0] === true) {
      return Babel.booleanLiteral(true);
    } else {
      return resolveClassNameInnerValue(value[0] as string);
    }
  } else {
    return (value as string[]).slice(2).reduce((acc, className) => {
      return Babel.logicalExpression(
        "||",
        acc,
        resolveClassNameInnerValue(className)
      );
    }, Babel.logicalExpression("||", resolveClassNameInnerValue(value[0] as string), resolveClassNameInnerValue(value[1] as string)));
  }
};

/**
 * Creates Babel Object expression from class names string
 * @param classNames
 */
export const createClassNameObject = (
  classNames: string
): Babel.ObjectExpression => {
  const classNameMap = classNames
    .split(" ")
    .reduce((acc: any, className: string) => {
      const [value, class1, class2] = className.split(":");
      if (class1 && !acc[class1]) {
        acc[class1] = [];
      }

      if (class2 && !acc[class2]) {
        acc[class2] = [];
      }
      if (className === `:${className.slice(1)}`) {
        acc[class1].push(true);
      } else if (className.includes("::") && class2) {
        acc[class2].push(`!${value}`);
      } else if (value && (class1 || class2)) {
        if (class1) {
          acc[class1].push(value);
        }
        if (class2) {
          acc[class2].push(`!${value}`);
        }
        
      }

      return acc;
    }, {}); 

  const objectProps = Object.entries(classNameMap).map(
    ([key, value]) => Babel.objectProperty(
      resolveClassName(key),
      resolveClassNameValue(value as StylePropValue)
    ));

  return Babel.objectExpression(objectProps);
};
