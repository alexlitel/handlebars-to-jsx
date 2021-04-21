import { AST as Glimmer }                                from '@glimmer/syntax'
import * as Babel                                        from '@babel/types'
import { createFragment, convertElement, createElement } from './elements'
import { createBlockElement, resolveBlockStatement }     from './blockStatements'
import { createComment }                                 from './comments'
import { encode } from 'html-entities';

/**
 * Converts mustache statement to something parseable
 */
export const resolveMustacheStatement = (
  statement: Glimmer.MustacheStatement
): any => {
  const statementPath = statement.path as any
  const original = statementPath.original || ''
  if (
    statementPath.type === 'PathExpression'
    && original.startsWith('emberComponent-')
  ) {
    return createElement(statement)
  }

  if (statement.params && !!statement.params.length) {
    return resolveHelpers(statement)
  }

  return resolveExpression(statement.path)
}

/**
 * Coerce helpers to inline functions
 */
export const resolveHelpers = (
  statement: Glimmer.MustacheStatement
): Babel.JSXExpressionContainer => {
  const params = statement.params.map((item: any) => {
    const value = item.original || item.value
    if (/\W/gi.test(String(value).trim())) {
      return Babel.stringLiteral(value)
    }
    return typeof value === 'number'
      ? Babel.numericLiteral(value)
      : Babel.identifier(value)
  })

  if (statement.hash && statement.hash.pairs && statement.hash.pairs.length) {
    const statementValues = statement.hash.pairs.map((item: any) => {

      if (item.value.type === 'StringLiteral' && /\w\.\w/g.test(item.value.original)) {
        (item.value as any).type = 'PathExpression';
        (item.value as any).parts = item.value.original.split(/\./g)
      }

      return Babel.objectProperty(Babel.identifier(item.key), resolveExpression(item.value, true))
    }) as any[]
    params.push(Babel.objectExpression(statementValues) as any)
  }

  return Babel.jsxExpressionContainer(
    Babel.callExpression(
      Babel.identifier(statement.path.original as any),
      params
    )
  )
}

/**
 * Converts the Handlebars expression to NON-JSX JS-compatible expression.
 * Creates top-level expression or expression which need to wrap to JSX
 * expression container.
 */
export const resolveStatement = (statement: Glimmer.Statement) => {
  switch (statement.type) {
    case 'ElementNode': {
      return convertElement(statement)
    }

    case 'TextNode': {
      return Babel.stringLiteral(statement.chars)
    }

    case 'MustacheStatement': {
      return resolveMustacheStatement(statement)
    }

    case 'BlockStatement': {
      return resolveBlockStatement(statement)
    }

    case 'MustacheCommentStatement':
    case 'CommentStatement': {
      return createComment(statement)
    }

    default: {
      throw new Error(`Unexpected expression "${statement.type}"`)
    }
  }
}

/**
 * Converts the Handlebars node to JSX-children-compatible child element.
 * Creates JSX expression or expression container with JS expression, to place
 * to children of a JSX element.
 */
export const resolveElementChild = (
  statement: Glimmer.Statement | Glimmer.BlockStatement
):
  | Babel.JSXText
  | Babel.JSXElement
  | Babel.JSXExpressionContainer
  | Array<Babel.JSXText | Babel.JSXExpressionContainer> => {
  switch (statement.type) {
    case 'ElementNode': {
      return convertElement(statement)
    }

    case 'TextNode': {
      return prepareJsxText(statement.chars)
    }

    case 'MustacheCommentStatement':
    case 'CommentStatement': {
      return createComment(statement)
    }

    case 'MustacheStatement': {
      return resolveMustacheStatement(statement)
    }

    case 'BlockStatement': {
      if (!/(if|each|unless)/i.test(statement.path.original)) {
        return createBlockElement(statement)
      }
    }

    // If it expression, create a expression container
    // eslint-disable-next-line
    default: {
      return Babel.jsxExpressionContainer(resolveStatement(statement))
    }
  }
}

/**
 * Converts Hbs expression to Babel expression
 */
export const resolveExpression = (
  expression: Glimmer.Expression,
  canReturnIdentifier: boolean = false
): Babel.Literal | Babel.Identifier | Babel.MemberExpression => {
  switch (expression.type) {
    case 'PathExpression': {
      return createPath(expression)
    }

    case 'BooleanLiteral': {
      return Babel.booleanLiteral(expression.value)
    }

    case 'NullLiteral': {
      return Babel.nullLiteral()
    }

    case 'NumberLiteral': {
      return Babel.numericLiteral(expression.value)
    }

    case 'StringLiteral': {
      if (canReturnIdentifier && !/\W/gi.test(expression.value)) {
        return Babel.identifier(expression.value)
      }
      return Babel.stringLiteral(expression.value)
    }

    case 'UndefinedLiteral': {
      return Babel.identifier('undefined')
    }

    default: {
      throw new Error('Unexpected mustache statement')
    }
  }
}

/**
 * Returns path to variable
 */
export const createPath = (
  pathExpression: Glimmer.PathExpression
): Babel.Identifier | Babel.MemberExpression => {
  const parts = pathExpression.parts
  
  if (parts.length === 0) {
    throw new Error('Unexpected empty expression parts')
  }

  // Start identifier
  let acc: Babel.Identifier | Babel.MemberExpression = Babel.identifier(
    parts[0]
  )

  for (let i = 1; i < parts.length; i++) {
    acc = appendToPath(acc, Babel.identifier(parts[i]))
  }

  return acc
}

/**
 * Appends item to path
 */
export const appendToPath = (
  path: Babel.MemberExpression | Babel.Identifier,
  append: Babel.Identifier
) => Babel.memberExpression(path, append)

/**
 * Prepends item to path
 */
export const prependToPath = (
  path: Babel.MemberExpression | Babel.Identifier,
  prepend: Babel.Identifier
) => Babel.memberExpression(prepend, path)

/**
 * Converts child statements of element to JSX-compatible expressions
 * @param body List of Glimmer statements
 */
export const createChildren = (
  body: Glimmer.Statement[]
): Babel.JSXElement['children'] =>
  body.reduce((acc, statement) => {
    let child = resolveElementChild(statement) as any
    if (
      (child.type && child.type === 'MemberExpression')
      || child.type === 'Identifier'
    ) {
      child = Babel.jsxExpressionContainer(child)
    }
    return Array.isArray(child) ? [...acc, ...child] : [...acc, child]
  }, [] as Babel.JSXElement['children'])

/**
 * Converts root children
 */
export const createRootChildren = (
  body: Glimmer.Statement[]
): Babel.Expression =>
  body.length === 1
    ? resolveStatement(body[0])
    : createFragment(createChildren(body))

/**
 * Creates attribute value concatenation
 */
export const createConcat = (
  parts: Glimmer.ConcatStatement['parts']
): Babel.BinaryExpression | Babel.Expression => {
  return parts.reduce((acc, item) => {
    let resolvedStatement = resolveStatement(item) as any
    if (resolvedStatement.expression) {
      resolvedStatement = resolvedStatement.expression
    }

    if (acc == null) {
      return resolvedStatement
    }

    return Babel.binaryExpression('+', acc, resolvedStatement)
  }, null as null | Babel.Expression | Babel.BinaryExpression) as
    | Babel.BinaryExpression
    | Babel.Expression
}

/**
 * Escapes syntax chars in jsx text
 * @param text
 */
export const prepareJsxText = (
  text: string
):
  | Babel.JSXExpressionContainer | Babel.JSXText
  | Array<Babel.JSXText | Babel.JSXExpressionContainer> => {
  // Escape jsx syntax chars
  const encodedText = encode(text);
  const parts = encodedText.split(/(:?{|})/);

  if (parts.length === 1) {
    if (/\&(\w|\d)+\;/gi.test(encodedText)) {
      return Babel.jsxExpressionContainer(Babel.stringLiteral(encodedText));
    }

    return Babel.jsxText(text);
  }

  return parts.map((item) =>
    item === "{" || item === "}" || /\&(\w|\d)+\;/gi.test(item)
      ? Babel.jsxExpressionContainer(Babel.stringLiteral(item))
      : Babel.jsxText(item)
  );
};
