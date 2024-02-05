import { isTagStartChar, isWhitespace, isEndOfTagSection } from './utils.js'

export const State = {
    Text: 'Text', // 文本状态
    BeforeTagName: 'BeforeTagName', // 开始收集 `开始标签名` 状态
    InTagName: 'InTagName', // 收集 `开始标签名` 状态
    BeforeClosingTagName: 'BeforeClosingTagName', // 开始收集 `结束标签名` 状态
    InClosingTagName: 'InClosingTagName', // 收集 `结束标签名` 状态
    AfterClosingTagName: 'AfterClosingTagName' // 收集完 `结束标签名` 后状态
}

export default class Tokenizer {
    state = State.Text
    buffer = ''
    index = 0
    // 语义块起始位置
    sectionStart = -1
    parseResults = []

    stateText(c) {
        if (c === '<') {
            // '<' 说明匹配到标签了
            if (this.index > this.sectionStart) {
                const token = this.buffer.slice(this.sectionStart, this.index)
                this.parseResults.push({
                    type: 'text',
                    value: token
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
                value: token
            })
            this.sectionStart = -1
            // 开始收集属性
            this.state = State.Text
            // this.handleTagName(c)
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
                value: token
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
                // ...
            }
            this.index++
        }
        return this.parseResults
    }
}
