import { isTagStartChar, isWhitespace, isEndOfTagSection } from './utils.js'

export const State = {
  Text: 'Text', // 文本状态
  BeforeTagName: 'BeforeTagName', // 开始收集 `开始标签名` 状态
  InTagName: 'InTagName', // 收集 `开始标签名` 状态
  BeforeClosingTagName: 'BeforeClosingTagName', // 开始收集 `结束标签名` 状态
  InClosingTagName: 'InClosingTagName', // 收集 `结束标签名` 状态
  AfterClosingTagName: 'AfterClosingTagName', // 收集完 `结束标签名` 后状态
  BeforeAttrName: 'BeforeAttrName', // 开始收集属性名状态
  InAttrName: 'InAttrName', // 收集属性名状态
  AfterAttrName: 'AfterAttrName', // 收集属性名完毕状态
  BeforeAttrValue: 'BeforeAttrValue', // 开始收集属性值状态
  InAttrValueDq: 'InAttrValueDq', // 收集使用双引号包裹的属性值
  InAttrValueSq: 'InAttrValueSq', // 收集使用单引号包裹的属性值
  InAttrValueNq: 'InAttrValueNq', // 收集不使用引号包裹的属性值
  InDirName: 'InDirName', // 收集指令名状态
  InDirArg: 'InDirArg', // 收集指令参数状态
  InDirModifier: 'InDirModifier', // 收集指令修饰符状态
}

const DIRECTIVE_LOGOGRAM = {
  ':': 'v-bind',
  '@': 'v-on',
  '#': 'v-slot',
}

export default class Tokenizer {
  state = State.Text
  buffer = ''
  index = 0
  // 语义块起始位置
  sectionStart = 0
  parseResults = []

  peek() {
    return this.buffer[this.index + 1]
  }

  stateText(c) {
    if (c === '<') {
      // '<' 说明匹配到标签了
      if (this.index > this.sectionStart) {
        const token = this.buffer.slice(this.sectionStart, this.index)
        this.parseResults.push({
          type: 'text',
          value: token,
        })
      }
      this.state = State.BeforeTagName
      this.sectionStart = this.index + 1
    }
  }

  stateBeforeTagName(c) {
    if (c === '!') {
      // <! html注释
      // 不处理
    } else if (c === '?') {
      // <? 处理指令
      // 不处理
    } else if (isTagStartChar(c)) {
      // 正式进入收集 开始标签名
      this.state = State.InTagName
      this.sectionStart = this.index
    } else if (c === '/') {
      // </ 开始进入收集 结束标签名
      this.state = State.BeforeClosingTagName
    } else {
      // 其他情况认为 < 的含义是一个普通字符串，并不是 html 标签的起始标识
      this.state = State.Text
      this.stateText(c)
    }
  }

  stateInTagName(c) {
    if (isEndOfTagSection(c)) {
      const token = this.buffer.slice(this.sectionStart, this.index)
      this.parseResults.push({
        type: 'tag',
        value: token,
      })
      this.sectionStart = -1
      // 开始收集属性
      this.state = State.BeforeAttrName
      this.stateBeforeAttrName(c)
    }
  }

  stateBeforeClosingTagName(c) {
    if (isTagStartChar(c)) {
      // 正式进入收集 结束标签名
      this.state = State.InClosingTagName
      this.sectionStart = this.index
    } else {
      // 其他情况就认为是字符串
      this.state = State.Text
      this.stateText(c)
    }
  }

  stateInClosingTagName(c) {
    if (isEndOfTagSection(c)) {
      const token = this.buffer.slice(this.sectionStart, this.index)
      this.parseResults.push({
        type: 'tagEnd',
        value: token,
      })

      this.sectionStart = -1
      this.state = State.AfterClosingTagName
      this.stateAfterClosingTagName(c)
    }
  }

  stateAfterClosingTagName(c) {
    // Skip everything until ">"
    if (c === '>') {
      this.state = State.Text
      this.sectionStart = this.index + 1 // 跳过当前字符 '>'
    }
  }

  stateBeforeAttrName(c) {
    if (c === '>') {
      this.state = State.Text
      this.sectionStart = this.index + 1
    } else if (!isWhitespace(c)) {
      this.handleAttrStart(c)
    }
    // 如果是空格获取其他乱七八糟的字符就跳过不处理
  }

  handleAttrStart(c) {
    if (c === 'v' && this.peek() === '-') {
      this.state = State.InDirName
      this.sectionStart = this.index
    } else if (c === '.' || c === ':' || c === '@' || c === '#') {
      const token = this.buffer.slice(this.index, this.index + 1)
      this.parseResults.push({
        type: 'directName',
        value: DIRECTIVE_LOGOGRAM[token], // 将指令简写转化成原指令
      })
      this.state = State.InDirArg
      this.sectionStart = this.index + 1
    } else {
      this.state = State.InAttrName
      this.sectionStart = this.index
    }
  }

  stateInAttrName(c) {
    if (c === '=' || isEndOfTagSection(c)) {
      const token = this.buffer.slice(this.sectionStart, this.index)
      this.parseResults.push({
        type: 'attributeName',
        value: token,
      })
      this.sectionStart = this.index
      this.state = State.AfterAttrName
      this.stateAfterAttrName(c)
    }
  }

  stateAfterAttrName(c) {
    if (c === '=') {
      this.state = State.BeforeAttrValue
    } else {
      this.state = State.BeforeAttrName
      this.stateBeforeAttrName(c)
    }
  }

  stateBeforeAttrValue(c) {
    if (c === '"') {
      this.state = State.InAttrValueDq
      this.sectionStart = this.index + 1
    } else if (c === "'") {
      this.state = State.InAttrValueSq
      this.sectionStart = this.index + 1
    } else if (!isWhitespace(c)) {
      this.sectionStart = this.index
      this.state = State.InAttrValueNq
      this.stateInAttrValueNoQuotes(c) // Reconsume token
    }
  }

  stateInAttrValueDoubleQuotes(c) {
    this.handleInAttrValue(c, '"')
  }
  stateInAttrValueSingleQuotes(c) {
    this.handleInAttrValue(c, "'")
  }

  handleInAttrValue(c, quote) {
    if (c === quote) {
      const token = this.buffer.slice(this.sectionStart, this.index)
      this.parseResults.push({
        type: 'attributeValue',
        value: token,
      })
      this.sectionStart = -1
      this.state = State.BeforeAttrName
    }
  }

  stateInAttrValueNoQuotes(c) {
    if (isWhitespace(c) || c === '>') {
      const token = this.buffer.slice(this.sectionStart, this.index)
      this.parseResults.push({
        type: 'attributeValue',
        value: token,
      })
      this.sectionStart = -1
      this.state = State.BeforeAttrName
      this.stateBeforeAttrName(c)
    }
  }

  stateInDirName(c) {
    if (c === '=' || isEndOfTagSection(c)) {
      const token = this.buffer.slice(this.sectionStart, this.index)
      this.parseResults.push({
        type: 'directName',
        value: token,
      })
      this.sectionStart = this.index
      this.state = State.AfterAttrName
      this.stateAfterAttrName(c)
    } else if (c === ':') {
      const token = this.buffer.slice(this.sectionStart, this.index)
      this.parseResults.push({
        type: 'directName',
        value: token,
      })
      this.state = State.InDirArg
      this.sectionStart = this.index + 1
    } else if (c === '.') {
      const token = this.buffer.slice(this.sectionStart, this.index)
      this.parseResults.push({
        type: 'directName',
        value: token,
      })
      this.state = State.InDirModifier
      this.sectionStart = this.index + 1
    }
  }

  stateInDirArg(c) {
    if (c === '=' || isEndOfTagSection(c)) {
      // 统一在这里处理，目前先简单判断
      const token = this.buffer.slice(this.sectionStart, this.index)
      if (token[0] === '[' && token[token.length - 1] === ']') {
        this.parseResults.push({
          type: 'directDynamicArgument',
          value: token.slice(1, -1),
        })
      } else {
        this.parseResults.push({
          type: 'directArgument',
          value: token,
        })
      }
      this.sectionStart = this.index
      this.state = State.AfterAttrName
      this.stateAfterAttrName(c)
    } else if (c === '.') {
      const token = this.buffer.slice(this.sectionStart, this.index)
      this.parseResults.push({
        type: 'directArgument',
        value: token,
      })
      this.state = State.InDirModifier
      this.sectionStart = this.index + 1
    }
  }

  stateInDirModifier(c) {
    if (c === '=' || isEndOfTagSection(c)) {
      const token = this.buffer.slice(this.sectionStart, this.index)
      this.parseResults.push({
        type: 'directModifier',
        value: token,
      })
      this.sectionStart = this.index
      this.state = State.AfterAttrName
      this.stateAfterAttrName(c)
    } else if (c === '.') {
      const token = this.buffer.slice(this.sectionStart, this.index)
      this.parseResults.push({
        type: 'directModifier',
        value: token,
      })
      this.sectionStart = this.index + 1
    }
  }

  parse(code) {
    this.buffer = code
    while (this.index < this.buffer.length) {
      const char = this.buffer[this.index]
      switch (this.state) {
        case State.Text: {
          this.stateText(char)
          break
        }
        case State.BeforeTagName: {
          this.stateBeforeTagName(char)
          break
        }
        case State.InTagName: {
          this.stateInTagName(char)
          break
        }
        case State.BeforeClosingTagName: {
          this.stateBeforeClosingTagName(char)
          break
        }
        case State.InClosingTagName: {
          this.stateInClosingTagName(char)
          break
        }
        case State.AfterClosingTagName: {
          this.stateAfterClosingTagName(char)
          break
        }
        case State.BeforeAttrName: {
          this.stateBeforeAttrName(char)
          break
        }
        case State.InAttrName: {
          this.stateInAttrName(char)
          break
        }
        case State.AfterAttrName: {
          this.stateAfterAttrName(char)
          break
        }
        case State.BeforeAttrValue: {
          this.stateBeforeAttrValue(char)
          break
        }
        case State.InAttrValueDq: {
          this.stateInAttrValueDoubleQuotes(char)
          break
        }
        case State.InAttrValueSq: {
          this.stateInAttrValueSingleQuotes(char)
          break
        }
        case State.InAttrValueNq: {
          this.stateInAttrValueNoQuotes(char)
          break
        }
        case State.InDirName: {
          this.stateInDirName(char)
          break
        }
        case State.InDirArg: {
          this.stateInDirArg(char)
          break
        }
        case State.InDirModifier: {
          this.stateInDirModifier(char)
          break
        }
      }
      this.index++
    }
    this.end()
    return this.parseResults
  }

  end() {
    if (this.sectionStart !== -1) {
      // 最后剩余内容默认是Text文本
      const token = this.buffer.slice(this.sectionStart, this.index)
      this.parseResults.push({
        type: 'text',
        value: token,
      })
      this.sectionStart = 0
    }
  }
}
