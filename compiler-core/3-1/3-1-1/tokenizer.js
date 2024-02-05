import { isKeyword, isWhitespace, isOperator } from './utils.js'

export const State = {
  Init: 'Init', // 初始状态
  Keyword: 'Keyword', // 关键字
  Identifier: 'Identifier', // 标识符（变量声明）
  Punctuator: 'Punctuator', // 运算符
  Comment: 'Comment', // 注释
  String: 'String', // 字符串
  Numeric: 'Numeric', // 数字类型
  Boolean: 'Boolean', // 布尔类型值
  Null: 'Null', // null
}

export default class Tokenizer {
  state = State.Init
  buffer = ''
  index = 0
  // 语义块起始位置
  sectionStart = -1
  parseResults = []

  stateInit(char) {
    // 如果不是分割符（空格、换行等）就是聚集
    if (!isWhitespace(char)) {
      if (this.sectionStart === -1) this.sectionStart = this.index
      return
    }
    // 如果遇到分割符就开始转变状态
    if (this.sectionStart === -1) {
      return
    }
    const token = this.buffer.slice(this.sectionStart, this.index)
    if (isKeyword(token)) {
      this.state = State.Keyword
      this.stateKeyword(char)
      return
    }
    if (isOperator(token)) {
      this.state = State.Punctuator
      this.statePunctuator(char)
      return
    }
    let type
    try {
      type = typeof JSON.parse(token)
      if (type === 'number') {
        this.state = State.Numeric
        this.stateNumeric(char)
        return
      }
    } catch (e) {
      // 1、null、undefined
      // 2、格式错误
      // 3、标识符
      if (token !== 'null' && token !== 'undefined') {
        this.state = State.Identifier
        this.stateIdentifier(char)
        return
      }
    }
  }

  stateKeyword(char) {
    const keywords = this.buffer.slice(this.sectionStart, this.index)
    this.parseResults.push({
      type: State.Keyword,
      value: keywords,
    })
    this.sectionStart = -1
    this.state = State.Init
  }

  stateIdentifier(char) {
    const identifier = this.buffer.slice(this.sectionStart, this.index)
    this.parseResults.push({
      type: State.Identifier,
      value: identifier,
    })
    this.sectionStart = -1
    this.state = State.Init
  }

  statePunctuator(char) {
    const punctuator = this.buffer.slice(this.sectionStart, this.index)
    this.parseResults.push({
      type: State.Punctuator,
      value: punctuator,
    })
    this.sectionStart = -1
    this.state = State.Init
  }

  stateNumeric(char) {
    const numeric = this.buffer.slice(this.sectionStart, this.index)
    this.parseResults.push({
      type: State.Numeric,
      value: numeric,
    })
    this.sectionStart = -1
    this.state = State.Init
  }

  parse(code) {
    this.buffer = code
    while (this.index < this.buffer.length) {
      const char = this.buffer[this.index]
      switch (this.state) {
        case State.Init: {
          this.stateInit(char)
          break
        }
        case State.Keyword: {
          this.stateKeyword(char)
          break
        }
        case State.Identifier: {
          this.stateIdentifier(char)
          break
        }
        case State.Punctuator: {
          this.statePunctuator(char)
          break
        }
        case State.Numeric: {
          this.stateNumeric(char)
          break
        }
        // ...
      }
      this.index++
    }
    this.end()
    return this.parseResults
  }

  end() {
    if (this.sectionStart !== -1) {
      // 构造一个结束符
      this.stateInit(' ')
    }
  }
}
