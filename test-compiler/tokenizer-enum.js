// 字符ascii枚举
export const CharCodes = {
  Tab: 0x9, // "\t"
  NewLine: 0xa, // "\n"
  FormFeed: 0xc, // "\f"
  CarriageReturn: 0xd, // "\r"
  Space: 0x20, // " "
  ExclamationMark: 0x21, // "!"
  Number: 0x23, // "#"
  Amp: 0x26, // "&"
  SingleQuote: 0x27, // "'"
  DoubleQuote: 0x22, // '"'
  GraveAccent: 96, // "`"
  Dash: 0x2d, // "-"
  Slash: 0x2f, // "/"
  Zero: 0x30, // "0"
  Nine: 0x39, // "9"
  Semi: 0x3b, // ";"
  Lt: 0x3c, // "<"
  Eq: 0x3d, // "="
  Gt: 0x3e, // ">"
  Questionmark: 0x3f, // "?"
  UpperA: 0x41, // "A"
  LowerA: 0x61, // "a"
  UpperF: 0x46, // "F"
  LowerF: 0x66, // "f"
  UpperZ: 0x5a, // "Z"
  LowerZ: 0x7a, // "z"
  LowerX: 0x78, // "x"
  LowerV: 0x76, // "v"
  Dot: 0x2e, // "."
  Colon: 0x3a, // ":"
  At: 0x40, // "@"
  LeftSquare: 91, // "["
  RightSquare: 93, // "]"
}

// 状态机所有的状态
export const State = {
  Text: 'Text',

  // interpolation
  InterpolationOpen: 'InterpolationOpen', // 插值语法开始符
  Interpolation: 'Interpolation',
  InterpolationClose: 'InterpolationClose', // 插值语法结束符

  // Tags
  BeforeTagName: 'BeforeTagName', // After <
  InTagName: 'InTagName',
  InSelfClosingTag: 'InSelfClosingTag',
  BeforeClosingTagName: 'BeforeClosingTagName',
  InClosingTagName: 'InClosingTagName',
  AfterClosingTagName: 'AfterClosingTagName',

  // Attrs
  BeforeAttrName: 'BeforeAttrName',
  InAttrName: 'InAttrName',
  InDirName: 'InDirName',
  InDirArg: 'InDirArg',
  InDirDynamicArg: 'InDirDynamicArg',
  InDirModifier: 'InDirModifier',
  AfterAttrName: 'AfterAttrName',
  BeforeAttrValue: 'BeforeAttrValue',
  InAttrValueDq: 'InAttrValueDq', // "
  InAttrValueSq: 'InAttrValueSq', // '
  InAttrValueNq: 'InAttrValueNq',

  // Declarations
  BeforeDeclaration: 'BeforeDeclaration', // !
  InDeclaration: 'InDeclaration',

  // Processing instructions
  InProcessingInstruction: 'InProcessingInstruction', // ?

  // Comments & CDATA
  BeforeComment: 'BeforeComment', // 注释
  CDATASequence: 'CDATASequence',
  InSpecialComment: 'InSpecialComment',
  InCommentLike: 'InCommentLike',

  // Special tags
  BeforeSpecialS: 'BeforeSpecialS', // Decide if we deal with `<script` or `<style`
  BeforeSpecialT: 'BeforeSpecialT', // Decide if we deal with `<title` or `<textarea`
  SpecialStartSequence: 'SpecialStartSequence',
  InRCDATA: 'InRCDATA',

  InEntity: 'InEntity',

  InSFCRootTagName: 'InSFCRootTagName',
}

export const ParseMode = {
  BASE: 'BASE',
  HTML: 'HTML',
  SFC: 'SFC',
}

// 引号类型
export const QuoteType = {
  NoValue: 'NoValue',
  Unquoted: 'Unquoted',
  Single: 'Single',
  Double: 'Double',
}

// Callbacks {
//   ontext(start: number, endIndex: number): void
//   ontextentity(char: string, start: number, endIndex: number): void

//   oninterpolation(start: number, endIndex: number): void

//   onopentagname(start: number, endIndex: number): void
//   onopentagend(endIndex: number): void
//   onselfclosingtag(endIndex: number): void
//   onclosetag(start: number, endIndex: number): void

//   onattribdata(start: number, endIndex: number): void
//   onattribentity(char: string, start: number, end: number): void
//   onattribend(quote: QuoteType, endIndex: number): void
//   onattribname(start: number, endIndex: number): void
//   onattribnameend(endIndex: number): void

//   ondirname(start: number, endIndex: number): void
//   ondirarg(start: number, endIndex: number): void
//   ondirmodifier(start: number, endIndex: number): void

//   oncomment(start: number, endIndex: number): void
//   oncdata(start: number, endIndex: number): void

//   onprocessinginstruction(start: number, endIndex: number): void
//   // ondeclaration(start: number, endIndex: number): void
//   onend(): void
//   onerr(code: ErrorCodes, index: number): void
// }
