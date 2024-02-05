import { isTagStartChar, isWhitespace, isEndOfTagSection } from './utils.js'

export const State = {
    AfterAttrName: 'AfterAttrName', // 收集属性名完毕状态
    BeforeAttrValue: 'BeforeAttrValue', // 开始收集属性值状态
    InAttrValueDq: 'InAttrValueDq', // 收集使用双引号包裹的属性值
    InAttrValueSq: 'InAttrValueSq', // 收集使用单引号包裹的属性值
    InAttrValueNq: 'InAttrValueNq' // 收集不使用引号包裹的属性值
}

export default class Tokenizer {
    state = State.AfterAttrName
    buffer = ''
    index = 0
    // 语义块起始位置
    sectionStart = -1
    parseResults = []

    stateAfterAttrName(c) {
        if (c === '=') {
            this.state = State.BeforeAttrValue
        } else {
            // this.state = State.BeforeAttrName
            // this.stateBeforeAttrName(c)
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
                value: token
            })
            this.sectionStart = -1
            // this.state = State.BeforeAttrName
        }
    }

    stateInAttrValueNoQuotes(c) {
        if (isWhitespace(c) || c === '>') {
            const token = this.buffer.slice(this.sectionStart, this.index)
            this.parseResults.push({
                type: 'attributeValue',
                value: token
            })
            this.sectionStart = -1
            // this.state = State.BeforeAttrName
            // this.stateBeforeAttrName(c)
        }
    }

    parse(code) {
        this.buffer = code
        while (this.index < this.buffer.length) {
            const char = this.buffer[this.index]
            switch (this.state) {
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
            }
            this.index++
        }
        return this.parseResults
    }
}
