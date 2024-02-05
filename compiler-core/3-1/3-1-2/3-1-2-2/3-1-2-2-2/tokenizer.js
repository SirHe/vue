import { isTagStartChar, isWhitespace, isEndOfTagSection } from './utils.js'

export const State = {
  Text: 'Text', // 文本状态
  BeforeAttrName: 'BeforeAttrName', // 开始收集属性名状态
  AfterAttrName: 'AfterAttrName', // 收集完属性名状态
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
  state = State.BeforeAttrName
  buffer = ''
  index = 0
  // 语义块起始位置
  sectionStart = -1
  parseResults = []

  peek() {
    return this.buffer[this.index + 1]
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

  stateAfterAttrName(c) {}

  parse(code) {
    this.buffer = code
    while (this.index < this.buffer.length) {
      const char = this.buffer[this.index]
      switch (this.state) {
        case State.BeforeAttrName: {
          this.stateBeforeAttrName(char)
          break
        }
        case State.AfterAttrName: {
          this.stateAfterAttrName(char)
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
    return this.parseResults
  }
}
