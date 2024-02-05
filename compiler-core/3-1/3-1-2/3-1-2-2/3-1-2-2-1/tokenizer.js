import { isTagStartChar, isWhitespace, isEndOfTagSection } from './utils.js'

export const State = {
  Text: 'Text', // 文本状态
  InterpolationOpen: 'InterpolationOpen', // 准备开始收集插值内容状态
  Interpolation: 'Interpolation', // 收集插值内容状态
  InterpolationClose: 'InterpolationClose', // 准备结束收集插值内容状态
}

export default class Tokenizer {
  state = State.Text
  buffer = ''
  index = 0
  // 语义块起始位置
  sectionStart = -1
  parseResults = []
  delimiterOpen = '{{'
  delimiterClose = '}}'
  delimiterIndex = -1

  stateText(c) {
    if (c === '<') {
      // '<' 说明匹配到标签了
    } else if (c === this.delimiterOpen[0]) {
      this.state = State.InterpolationOpen
      this.delimiterIndex = 0
      this.stateInterpolationOpen(c)
    }
  }

  stateInterpolationOpen(c) {
    // 使用双指针滑动匹配
    if (c === this.delimiterOpen[this.delimiterIndex]) {
      if (this.delimiterIndex === this.delimiterOpen.length - 1) {
        // delimiterIndex 指针走到末尾，说明前缀完全匹配
        const start = this.index + this.delimiterOpen.length - 1 // 去掉 {{
        if (start > this.sectionStart) {
          // 需要保存 '{{' 前面的字符串内容
          const token = this.buffer.slice(this.sectionStart, start)
          this.parseResults.push({
            type: 'text',
            value: token,
          })
        }
        this.state = State.Interpolation
        this.sectionStart = start
      } else {
        this.delimiterIndex++
      }
    } else {
      this.state = State.Text
      this.stateText(c)
    }
  }

  stateInterpolation(c) {
    if (c === this.delimiterClose[0]) {
      this.state = State.InterpolationClose
      this.delimiterIndex = 0
      this.stateInterpolationClose(c)
    }
  }

  stateInterpolationClose(c) {
    if (c === this.delimiterClose[this.delimiterIndex]) {
      if (this.delimiterIndex === this.delimiterClose.length - 1) {
        const token = this.buffer.slice(this.sectionStart, this.index - 1) // 去掉 }}
        this.parseResults.push({
          type: 'interpolation',
          value: token,
        })
        this.delimiterIndex = -1
        this.sectionStart = this.index + 1
        this.state = State.Text
      } else {
        this.delimiterIndex++
      }
    } else {
      this.state = State.Interpolation
      this.stateInterpolation(c)
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
        case State.InterpolationOpen: {
          this.stateInterpolationOpen(char)
          break
        }
        case State.Interpolation: {
          this.stateInterpolation(char)
          break
        }
        case State.InterpolationClose: {
          this.stateInterpolationClose(char)
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
