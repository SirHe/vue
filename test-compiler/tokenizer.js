import { State, CharCodes, QuoteType } from './tokenizer-enum.js'

const defaultDelimitersOpen = new Uint8Array([123, 123]) // "{{"
const defaultDelimitersClose = new Uint8Array([125, 125]) // "}}"

const isWhitespace = (c) =>
  c === CharCodes.Space ||
  c === CharCodes.NewLine ||
  c === CharCodes.Tab ||
  c === CharCodes.FormFeed ||
  c === CharCodes.CarriageReturn

const isTagStartChar = (c) =>
  (c >= CharCodes.LowerA && c <= CharCodes.LowerZ) ||
  (c >= CharCodes.UpperA && c <= CharCodes.UpperZ)

const isEndOfTagSection = (c) =>
  // '/'、'>'、空格 认为是标签名称解析结束
  c === CharCodes.Slash || c === CharCodes.Gt || isWhitespace(c)

class Tokenizer {
  // 当前状态
  state = State.Text
  // 缓存正在处理的文本
  buffer = ''
  // 字符游标
  index = 0
  // 是否禁止解析插值语法
  inVPre = false
  // 语义块起始位置
  sectionStart = 0

  delimiterOpen = defaultDelimitersOpen
  delimiterClose = defaultDelimitersClose
  delimiterIndex = -1 //

  constructor(stack = [], cbs = []) {
    this.stack = stack
    this.cbs = cbs
  }

  // 下一个字符
  peek() {
    return this.buffer.charCodeAt(this.index + 1)
  }

  reset() {
    this.index = 0
    this.buffer = ''
    this.state = State.Text
    this.delimiterOpen = defaultDelimitersOpen
    this.delimiterClose = defaultDelimitersClose
  }

  stateText(c) {
    // 文本可能以标签开头，也可能没有html标签就是一段纯文本，或者一段插值表达式
    if (c === CharCodes.Lt) {
      // '<' 说明匹配到标签了
      this.state = State.BeforeTagName
      this.sectionStart = this.index
    } else if (!this.inVPre && c === this.delimiterOpen[0]) {
      // '{{'
      this.state = State.InterpolationOpen
      this.delimiterIndex = 0
      this.stateInterpolationOpen(c)
    }
  }

  stateInterpolationOpen(c) {
    // 这里采用了双指针，同步滑动两个指针
    if (c === this.delimiterOpen[this.delimiterIndex]) {
      // 插值开始符匹配完成
      if (this.delimiterIndex === this.delimiterOpen.length - 1) {
        // 指针回退到开始匹配到 '{' 的位置
        const start = this.index + 1 - this.delimiterOpen.length
        if (start > this.sectionStart) {
          this.cbs.ontext(this.sectionStart, start)
        }
        this.state = State.Interpolation
        this.sectionStart = start
      } else {
        this.delimiterIndex++
      }
    }
    // else if (this.inRCDATA) {
    //   this.state = State.InRCDATA
    //   this.stateInRCDATA(c)
    // }
    else {
      // 当插值符号匹配完毕之后，转变成普通文本状态
      this.state = State.Text
      this.stateText(c)
    }
  }

  stateBeforeTagName(c) {
    if (c === CharCodes.ExclamationMark) {
      // <！html注释
      // 不处理
    } else if (c === CharCodes.Questionmark) {
      // <? 处理指令
      // 不处理
    } else if (isTagStartChar(c)) {
      // 先不考虑其他情况
      this.state = State.InTagName
      this.sectionStart = this.index
    } else if (c === CharCodes.Slash) {
      // </
      this.state = State.BeforeClosingTagName
    } else {
      // 其他情况认为 < 的含义是一个普通字符串，并不是 html 标签的起始标识
      this.state = State.Text
      this.stateText(c)
    }
  }

  stateInTagName(c) {
    if (isEndOfTagSection(c)) {
      this.handleTagName(c)
    }
  }

  handleTagName(c) {
    this.cbs.onopentagname(this.sectionStart, this.index)
    this.sectionStart = -1
    this.state = State.BeforeAttrName
    this.stateBeforeAttrName(c)
  }

  stateBeforeAttrName(c) {
    if (c === CharCodes.Gt) {
      // '>'
      this.cbs.onopentagend(this.index)
      // 转换成普通的文本状态
      this.state = State.Text
      // 文本语义块的起始位置
      this.sectionStart = this.index + 1
    } else if (c === CharCodes.Slash) {
      // '/' 自闭合标签
      this.state = State.InSelfClosingTag
    } else if (!isWhitespace(c)) {
      this.handleAttrStart(c)
    }
  }

  handleAttrStart(c) {
    if (c === CharCodes.LowerV && this.peek() === CharCodes.Dash) {
      // v- 表示指令
      this.state = State.InDirName
      this.sectionStart = this.index // 从 v 开始
    } else if (
      c === CharCodes.Dot ||
      c === CharCodes.Colon ||
      c === CharCodes.At ||
      c === CharCodes.Number
    ) {
      // '.'、':'、'@'、'#' v-bind简写、v-on简写、
      this.cbs.ondirname(this.index, this.index + 1)
      this.state = State.InDirArg
      this.sectionStart = this.index + 1
    } else {
      // 普通属性
      this.state = State.InAttrName
      this.sectionStart = this.index
    }
  }

  // 属性参数
  stateInDirArg(c) {
    if (c === CharCodes.Eq || isEndOfTagSection(c)) {
      this.cbs.ondirarg(this.sectionStart, this.index)
      this.handleAttrNameEnd(c)
    } else if (c === CharCodes.LeftSquare) {
      // '[' 属性名动态参数
      this.state = State.InDirDynamicArg
    } else if (c === CharCodes.Dot) {
      // '.' 事件修饰符
      this.cbs.ondirarg(this.sectionStart, this.index)
      this.state = State.InDirModifier
      this.sectionStart = this.index + 1
    }
  }

  stateInDirModifier(c) {
    if (c === CharCodes.Eq || isEndOfTagSection(c)) {
      this.cbs.ondirmodifier(this.sectionStart, this.index)
      this.handleAttrNameEnd(c)
    } else if (c === CharCodes.Dot) {
      // 多个事件修饰符连用
      this.cbs.ondirmodifier(this.sectionStart, this.index)
      this.sectionStart = this.index + 1
    }
  }

  stateInDynamicDirArg(c) {
    if (c === CharCodes.RightSquare) {
      // ']'
      this.state = State.InDirArg
    }
  }

  stateInAttrName(c) {
    if (c === CharCodes.Eq || isEndOfTagSection(c)) {
      this.cbs.onattribname(this.sectionStart, this.index)
      this.handleAttrNameEnd(c)
    }
  }

  stateInDirName(c) {
    if (c === CharCodes.Eq || isEndOfTagSection(c)) {
      // =、空格
      this.cbs.ondirname(this.sectionStart, this.index)
      this.handleAttrNameEnd(c)
    } else if (c === CharCodes.Colon) {
      this.cbs.ondirname(this.sectionStart, this.index)
      this.state = State.InDirArg
      this.sectionStart = this.index + 1
    } else if (c === CharCodes.Dot) {
      this.cbs.ondirname(this.sectionStart, this.index)
      this.state = State.InDirModifier
      this.sectionStart = this.index + 1
    }
  }

  handleAttrNameEnd(c) {
    this.sectionStart = this.index
    this.state = State.AfterAttrName
    this.cbs.onattribnameend(this.index)
    this.stateAfterAttrName(c)
  }

  stateAfterAttrName(c) {
    if (c === CharCodes.Eq) {
      this.state = State.BeforeAttrValue
    } else if (c === CharCodes.Slash || c === CharCodes.Gt) {
      // '/'、'>'
      this.cbs.onattribend(QuoteType.NoValue, this.sectionStart)
      this.sectionStart = -1
      this.state = State.BeforeAttrName
      this.stateBeforeAttrName(c)
    } else if (!isWhitespace(c)) {
      this.cbs.onattribend(QuoteType.NoValue, this.sectionStart)
      // 下一个属性
      this.handleAttrStart(c)
    }
  }

  stateBeforeAttrValue(c) {
    if (c === CharCodes.DoubleQuote) {
      // "
      this.state = State.InAttrValueDq
      this.sectionStart = this.index + 1
    } else if (c === CharCodes.SingleQuote) {
      // '
      this.state = State.InAttrValueSq
      this.sectionStart = this.index + 1
    } else if (!isWhitespace(c)) {
      // 不处理
    }
    // 其他空格会直接不处理，忽略掉
  }

  stateInAttrValueDoubleQuotes(c) {
    this.handleInAttrValue(c, CharCodes.DoubleQuote)
  }

  stateInAttrValueSingleQuotes(c) {
    this.handleInAttrValue(c, CharCodes.SingleQuote)
  }

  handleInAttrValue(c, quote) {
    if (c === quote) {
      // 匹配到另外一个引号，表示属性值匹配结束
      this.cbs.onattribdata(this.sectionStart, this.index)
      this.sectionStart = -1
      this.cbs.onattribend(
        quote === CharCodes.DoubleQuote ? QuoteType.Double : QuoteType.Single,
        this.index + 1
      )
      this.state = State.BeforeAttrName
    }
  }

  stateInSelfClosingTag(c) {
    if (c === CharCodes.Gt) {
      // '>'
      this.cbs.onselfclosingtag(this.index)
      this.state = State.Text
      this.sectionStart = this.index + 1
    } else if (!isWhitespace(c)) {
      this.state = State.BeforeAttrName
      this.stateBeforeAttrName(c)
    }
  }

  parse(input) {
    this.buffer = input
    while (this.index < this.buffer.length) {
      const c = this.buffer.charCodeAt(this.index)

      switch (this.state) {
        case State.Text: {
          this.stateText(c)
          break
        }
        case State.InterpolationOpen: {
          this.stateInterpolationOpen(c)
          break
        }
        case State.BeforeTagName: {
          this.stateBeforeTagName(c)
          break
        }
        case State.InTagName: {
          this.stateInTagName(c)
          break
        }
        case State.BeforeAttrName: {
          this.stateBeforeAttrName(c)
          break
        }
        case State.InSelfClosingTag: {
          this.stateInSelfClosingTag(c)
          break
        }
        case State.InDirName: {
          this.stateInDirName(c)
          break
        }
        case State.AfterAttrName: {
          this.stateAfterAttrName(c)
          break
        }
        case State.BeforeAttrValue: {
          this.stateBeforeAttrValue(c)
          break
        }
        case State.InDirArg: {
          this.stateInDirArg(c)
          break
        }
        case State.InAttrName: {
          this.stateInAttrName(c)
          break
        }
        case State.InDirDynamicArg: {
          this.stateInDynamicDirArg(c)
          break
        }
        case State.InDirModifier: {
          this.stateInDirModifier(c)
          break
        }
        case State.InAttrValueDq: {
          this.stateInAttrValueDoubleQuotes(c)
          break
        }
        case State.InAttrValueSq: {
          this.stateInAttrValueSingleQuotes(c)
          break
        }
      }
      this.index++
    }
    this.cleanup()
    this.finish()
  }

  cleanup() {
    // If we are inside of text or attributes, emit what we already have.
    if (this.sectionStart !== this.index) {
      if (this.state === State.Text) {
        this.cbs.ontext(this.sectionStart, this.index)
        this.sectionStart = this.index
      } else if (
        this.state === State.InAttrValueDq ||
        this.state === State.InAttrValueSq ||
        this.state === State.InAttrValueNq
      ) {
        this.cbs.onattribdata(this.sectionStart, this.index)
        this.sectionStart = this.index
      }
    }
  }

  finish() {
    this.cbs.onend()
  }
}

export default Tokenizer
