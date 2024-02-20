import { State } from './state.js'
import { isEndOfTagSection } from './utils.js'

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
      this.sectionStart = this.index + 1
      this.state = State.InTagName
    }
  }
  stateInTagName(c) {
    // 遇到结束符标签名称就收集完毕
    if (isEndOfTagSection(c)) {
      // 状态处理逻辑 --- 这里只是做一个简单的搜集
      const token = this.buffer.slice(this.sectionStart, this.index)
      this.parseResults.push({
        type: 'tagName',
        value: token,
      })

      // 状态转移
      if (c === '>') {
        this.sectionStart = this.index + 1
        this.state = State.InTagValue
      } else if (c === '/' && this.peek() === '>') {
        this.sectionStart = this.index + 2
        this.state = State.Text
      } else {
        this.sectionStart = this.index + 1
        this.state = State.InAttrName
      }
    }
  }
  stateInAttrName(c) {
    // 有可能有属性值，也可能没有属性值
    if (c === '=' || c === '>') {
      const token = this.buffer.slice(this.sectionStart, this.index)
      this.parseResults.push({
        type: 'attrName',
        value: token,
      })

      // 状态转移
      if (c === '=') {
        this.sectionStart = this.index + 1
        this.state = State.InAttrValue
      } else {
        this.sectionStart = this.index + 1
        this.state = State.InTagValue
      }
    }
  }
  stateInAttrValue (c) {
    if()
  }
  stateInTagValue(c) {}

  parse(code) {
    this.buffer = code
    while (this.index < this.buffer.length) {
      const char = this.buffer[this.index]
      switch (this.state) {
        case State.Text: {
          this.stateText(char)
          break
        }
        case State.InTagName: {
          this.stateInTagName(char)
          break
        }
        case State.InAttrName: {
          this.stateInAttrName(char)
          break
        }
        case State.InAttrValue: {
          this.stateInAttrValue(char)
          break
        }
        case State.InTagValue: {
          this.stateInTagValue(char)
          break
        }
      }
    }
  }
}
