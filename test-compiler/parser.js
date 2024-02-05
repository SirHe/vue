// 构建抽象语法树
import { Tokenizer } from './tokenizer.js'

// 当前正在解析的字符串
let currentInput = ''
// 当前正在解析的html标签
let currentOpenTag = null

const tokenizer = new Tokenizer(stack, {
  ontext(start, end) {
    onText(getSlice(start, end), start, end)
  },
  onopentagname(start, end) {},
  onopentagend(end) {},
  // 属性名处理
  ondirname(start, end) {},
  // 属性参数
  ondirarg(start, end) {},
  // 事件修饰符处理
  ondirmodifier(start, end) {},
  // 属性值处理
  onattribdata(start, end) {},
  onattribnameend(end) {},
  onattribend(quote, end) {},
  // 解析完成
  onend() {},
})

tokenizer.parse(currentInput)

const getSlice = (start, end) => currentInput.slice(start, end)

const onText = (content, start, end) => {
  const parent = stack[0] || currentRoot
  const lastNode = parent.children[parent.children.length - 1]
  if (lastNode?.type === NodeTypes.TEXT) {
    // merge
    lastNode.content += content
    setLocEnd(lastNode.loc, end)
  } else {
    parent.children.push({
      type: NodeTypes.TEXT,
      content,
      loc: getLoc(start, end),
    })
  }
}

const endOpenTag = (end) => {
  addNode(currentOpenTag)
  const { tag, ns } = currentOpenTag
  if (ns === Namespaces.HTML && currentOptions.isPreTag(tag)) {
    inPre++
  }
  if (currentOptions.isVoidTag(tag)) {
    onCloseTag(currentOpenTag, end)
  } else {
    stack.unshift(currentOpenTag)
    if (ns === Namespaces.SVG || ns === Namespaces.MATH_ML) {
      tokenizer.inXML = true
    }
  }
  currentOpenTag = null
}
