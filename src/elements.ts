import { AST as Glimmer }                                  from '@glimmer/syntax'
import * as Babel                                          from '@babel/types'
import * as isSelfClosing                                  from 'is-self-closing'
import * as convertHTMLAttribute                           from 'react-attr-converter'
import { createConcat, resolveExpression, createChildren } from './expressions'
import { createClassNameObject, createStyleObject }        from './styles'
import { parseExpression }                                 from '@babel/parser'

/**
 * Create element
 *
 */

export const createElement = (mustacheStatement: Glimmer.MustacheStatement): Babel.JSXElement => {
  const blockNode = {} as Partial<Glimmer.ElementNode>
  blockNode.type = 'ElementNode'
  blockNode.tag = (mustacheStatement.path.original as string)
    .split('-')
    .map(
      (stringPart) => stringPart.charAt(0).toUpperCase() + stringPart.slice(1)
    )
    .join('')
  blockNode.attributes = mustacheStatement.hash.pairs.map((item) => {
    const attrNode = {
      type: 'AttrNode',
    } as any
    attrNode.name = item.key
    attrNode.value = {
      type:
        item.value.type === 'StringLiteral' ? 'TextNode' : 'MustacheStatement',
      chars: String((item.value as Glimmer.PathExpression).original || ''),
      path:  item.value,
    }

    return attrNode
  }) as Glimmer.AttrNode[]

  blockNode.selfClosing = true
  blockNode.children = []
  return convertElement(blockNode as Glimmer.ElementNode)
}
/**
 * Creates JSX fragment
 */
export const createFragment = (
  children: Babel.JSXFragment['children'],
  attributes: (Babel.JSXAttribute | Babel.JSXSpreadAttribute)[] = []
) => {
  const fragmentMemberExpression = Babel.jsxMemberExpression(
      Babel.jsxIdentifier('React'),
      Babel.jsxIdentifier('Fragment')
    )

  const openingFragment = Babel.jsxOpeningElement(
      fragmentMemberExpression,
      attributes
    )
  const closingFragment = Babel.jsxClosingElement(fragmentMemberExpression)

  return Babel.jsxElement(openingFragment, closingFragment, children, false)
  // }
}

/**
 * Coverts AttrNode to JSXAttribute
 */
export const createAttribute = (
  attrNode: Glimmer.AttrNode
): Babel.JSXAttribute | null => {
  // Unsupported attribute
  const reactAttrName = convertHTMLAttribute(attrNode.name)

  if (!/^[_\-A-z0-9]+$/.test(reactAttrName)) {
    return null
  }

  const name = Babel.jsxIdentifier(reactAttrName)
  const value = attrNode.value

  switch (value.type) {
    case 'TextNode': {
      if (reactAttrName === 'style') {
        const styleObjectExpression = createStyleObject(value)
        return Babel.jsxAttribute(
          name,
          Babel.jsxExpressionContainer(styleObjectExpression)
        )
      }

      return Babel.jsxAttribute(name, Babel.stringLiteral(value.chars))
    }

    case 'MustacheStatement': {
      return Babel.jsxAttribute(
        name,
        Babel.jsxExpressionContainer(resolveExpression(value.path))
      )
    }

    case 'ConcatStatement': {
      const expression = createConcat(value.parts)
      if (reactAttrName === 'style') {
        const styleObjectExpression = createStyleObject(value)
        return Babel.jsxAttribute(
          name,
          Babel.jsxExpressionContainer(styleObjectExpression)
        )
      }

      return Babel.jsxAttribute(name, Babel.jsxExpressionContainer(expression))
    }

    default: {
      throw new Error('Unexpected attribute value')
    }
  }
}

/**
 * Converts modifiers to attributes
 */

export const convertModifier = (
  modifier: Glimmer.ElementModifierStatement
): Babel.JSXAttribute | Babel.JSXAttribute[] | null => {
  const modifierType = modifier.path.original
  let attrName: any

  if (modifierType === 'action') {
    attrName = Babel.jsxIdentifier('onClick')
    const [actionName, ...actionArguments] = modifier.params.map((item: any) => {
      const value = item.original || item.value
      return typeof value === 'number' ? Babel.numericLiteral(value) : Babel.identifier(value)
    })
    if (actionArguments.length) {
      return Babel.jsxAttribute(
        attrName,
        Babel.jsxExpressionContainer(
          Babel.arrowFunctionExpression(
            [],
            Babel.callExpression(
              actionName,
              actionArguments
            )
          )
        )
      )
    }

    return Babel.jsxAttribute(
      attrName,
      Babel.jsxExpressionContainer(actionName),
    )
  }

  if (modifierType === 'bind-attr') {
    if (modifier.hash.pairs) {
      return modifier.hash.pairs.map(item => {
        let attrName: any = item.key
        let attrValue: any = (item.value as any).original
        if (attrName === 'class') {
          attrName = 'className'

          attrValue = Babel.callExpression(
            Babel.identifier('clsx'),
            [createClassNameObject(attrValue)]
          )
        } else {
          attrValue = Babel.identifier(attrValue)
        }

        return Babel.jsxAttribute(
          Babel.jsxIdentifier(attrName),
          Babel.jsxExpressionContainer(attrValue),
        )
      })
    }
  }

  return null
}

/**
 * Converts ElementNode to JSXElement
 */
export const convertElement = (node: Glimmer.ElementNode): Babel.JSXElement => {
  const tagName = Babel.jsxIdentifier(node.tag)
  const attributes = node.attributes
    .map(item => createAttribute(item))
    .filter(Boolean) as Babel.JSXAttribute[]

  if (node.modifiers && node.modifiers.length) {
    const modifiers = node.modifiers.reduce((acc, item) => acc.concat(convertModifier(item) as []), []).filter(Boolean) as Babel.JSXAttribute[]

    attributes.push(...modifiers)
  }
  const isElementSelfClosing = node.selfClosing || isSelfClosing(node.tag)
  const children = createChildren(node.children)

  return Babel.jsxElement(
    Babel.jsxOpeningElement(tagName, attributes, isElementSelfClosing),
    Babel.jsxClosingElement(tagName),
    isElementSelfClosing ? [] : children,
    isElementSelfClosing
  )
}
