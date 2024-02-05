import { isTagStartChar, isWhitespace, isEndOfTagSection } from './utils.js'

export const State = {
    InTagName: 'InTagName', // 收集 `开始标签名` 状态
    BeforeAttrName: 'BeforeAttrName', // 开始收集属性名状态
    InAttrName: 'InAttrName', // 收集属性名状态
    AfterAttrName: 'AfterAttrName' // 收集属性名完毕状态
}

export default class Tokenizer {
    state = State.InTagName
    buffer = ''
    index = 0
    // 语义块起始位置
    sectionStart = -1
    parseResults = []

    stateInTagName(c) {
        if (isEndOfTagSection(c)) {
            // const token = this.buffer.slice(this.sectionStart, this.index)
            // this.parseResults.push({
            //     type: 'tag',
            //     value: token
            // })
            this.sectionStart = -1
            // 开始收集属性
            this.state = State.BeforeAttrName
            this.stateBeforeAttrName(c)
        }
    }

    stateBeforeAttrName(c) {
        if (c === '>') {
            this.state = State.Text
            this.sectionStart = this.index + 1
        } else if (!isWhitespace(c)) {
            this.state = State.InAttrName
            this.sectionStart = this.index
        }
        // 如果是空格获取其他乱七八糟的字符就跳过不处理
    }

    stateInAttrName(c) {
        if (c === '=' || isEndOfTagSection(c)) {
            const token = this.buffer.slice(this.sectionStart, this.index)
            this.parseResults.push({
                type: 'attributeName',
                value: token
            })
            this.sectionStart = this.index
            this.state = State.AfterAttrName
            this.stateAfterAttrName(c)
        }
    }

    stateAfterAttrName(c) {
        if (c === '=') {
            // this.state = State.BeforeAttrValue
        } else {
            this.state = State.BeforeAttrName
            this.stateBeforeAttrName(c)
        }
    }

    parse(code) {
        this.buffer = code
        while (this.index < this.buffer.length) {
            const char = this.buffer[this.index]
            switch (this.state) {
                case State.InTagName: {
                    this.stateInTagName(char)
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
            }
            this.index++
        }
        return this.parseResults
    }
}
