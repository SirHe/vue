export const isKeyword = (str) => {
  // JavaScript 关键字列表
  const keywords = [
    'break',
    'case',
    'catch',
    'class',
    'const',
    'continue',
    'debugger',
    'default',
    'delete',
    'do',
    'else',
    'export',
    'extends',
    'finally',
    'for',
    'function',
    'if',
    'import',
    'in',
    'instanceof',
    'let',
    'new',
    'return',
    'super',
    'switch',
    'this',
    'throw',
    'try',
    'typeof',
    'var',
    'void',
    'while',
    'with',
    'yield',
    'enum',
    'await',
    'implements',
    'package',
    'protected',
    'static',
    'interface',
    'private',
    'public',
    // 这里列出了 ECMAScript 6 及更新版本中的关键字
  ]

  // 判断字符串是否是 JavaScript 关键字
  return keywords.includes(str)
}

export const isOperator = (str) => {
  // JavaScript 运算符列表
  const operators = [
    '+',
    '-',
    '*',
    '/',
    '%', // 算术运算符
    '=',
    '==',
    '===',
    '!=',
    '!==', // 比较运算符
    '>',
    '<',
    '>=',
    '<=', // 比较运算符
    '&&',
    '||',
    '!', // 逻辑运算符
    '&',
    '|',
    '^',
    '~',
    '<<',
    '>>',
    '>>>', // 位运算符
    '+=',
    '-=',
    '*=',
    '/=',
    '%=', // 赋值运算符
    '&=',
    '|=',
    '^=',
    '<<=',
    '>>=',
    '>>>=', // 赋值运算符
    '++',
    '--', // 自增自减运算符
    'typeof',
    'instanceof',
    'in',
    'delete', // 其他运算符
    '?',
    ':', // 条件运算符
    ',', // 逗号运算符
    'void',
    'delete', // 一元运算符
    'new',
    'typeof', // 特殊运算符
  ]

  // 判断字符串是否是 JavaScript 运算符
  return operators.includes(str)
}

export const isWhitespace = (char) =>
  char === ' ' ||
  char === '\t' ||
  char === '\n' ||
  char === '\r' ||
  char === '\f'
