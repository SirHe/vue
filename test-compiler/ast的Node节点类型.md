词法分析的第一步就是确定有哪些分词类型（也就是句子中包含哪几种语义单元），我们先看下面这个例子：

```html
<div id="foo" v-if="true">hello {{ name }}</div>
<!-- 123 -->
```

对于上面的 html 片段，我们可以分为以下这几种语义类型：

div：html 标签
id：html 属性
v-if：vue 指令
hello：html 文本
{{ name }}：vue 插值表达式

于是我们分词的语义类型的枚举如下：

```js
const NodeTypes = {
  ELEMENT: 'ELEMENT', // 元素
  ATTRIBUTE: 'ATTRIBUTE', // 属性
  DIRECTIVE: 'DIRECTIVE', // 指令
  TEXT: 'TEXT', // 文本节点
  INTERPOLATION: 'INTERPOLATION', // 插值
  ROOT: 'ROOT', // 根节点
  SIMPLE_EXPRESSION: 'SIMPLE_EXPRESSION', // 简单表达式
  COMPOUND_EXPRESSION: 'COMPOUND_EXPRESSION', // 复杂表达式
  COMMENT: 'COMMENT', // 注释
}

// 元素（tag）类型
const ElementTypes = {
  ELEMENT: 'ELEMENT',
  COMPONENT: 'COMPONENT',
}
```

可以发现，我们后面多增加了三种：ROOT、SIMPLE_EXPRESSION 和 COMMENT，相信大家应该可以通过注释来了解到他们的作用，这里就不再赘述了。

值得一提的是：**其实我们对于分词的大小并没有要求，只要是能组成一个完整的语义就可以划分到一起**。比如我们不能分成：`di`、`vi=`、`"foo"v-if`...这种，这种就是破坏了最小语义，但是我们可以分成`div`、`id="foo" v-if="true"`、`hello {{'world'}}`，只不过一般来说划分到最小语义是最好的。因为在状态机算法中，每一个语义就代表一种状态，而每一种状态都是由一个独立的方法去处理。所以语义划分得越细，这些方法的职责就越单一，维护起来也会更容易。

**其实从一个宏观的角度来看，vue 的 template 如果除去那些特殊的语法，比如 vue 的指令、插值语法。那我们完全可以使用正则把这些语法相关的内容捞出来，然后替换对应的计算结果，最后在内存中创建一个 dom 对象，使用 innerHTML 将模版挂上去解析，最后由真实对象来转化得到虚拟 dom 不就可以了。为啥还需要自己去实现一个模板引擎呢？**

# 1、根节点

```js
{
  type: NodeTypes.ROOT,
  children: [] // 子节点
}
```

# 2、纯文本节点

```js
{
  type: NodeTypes.TEXT,
  content: 'hello '
}
```

# 3、表达式节点

```js
{
  type: NodeTypes.SIMPLE_EXPRESSION,
  content: 'name',
  isStatic: false
}
```

# 4、差值节点

```js
{
  type: NodeTypes.INTERPOLATION,
  content: {
    type: NodeTypes.SIMPLE_EXPRESSION,
    content: 'name',
    isStatic: false
  }
}
```

# 5、元素节点

```js
{
  type: NodeTypes.ELEMENT,
  tag: 'div', // html标签名或者组件名
  tagType: ElementTypes.ELEMENT, // 元素类型（html标签还是组件）
  props: [], // 属性
  directives: [], // 指令
  isSelfClosing: false, // 是否自闭合
  children: [] // 子节点
}
```

# 6、属性节点

```js
{
  type: NodeTypes.ATTRIBUTE,
  name: 'id', // 属性名
  value: {
    type: NodeTypes.TEXT,
    content: 'foo',
  }
}
```

# 7、指令节点

在 vue 中，指令以 `v-` 开头，后面跟上指令名称。

```html
<div :class="myClass"></div>
<div @click="onClick"></div>
<!-- 等同于 -->
<div v-bind:class="myClass"></div>
<div v-on:click="onClick"></div>
```

通过上面这个例子：**bind、on 就是指令，而 class 和 click 就是参数，最后末尾的 myClass 和 onClick 就是表达式**。

```js
{
  type: NodeTypes.DIRECTIVE,
  name: 'if', // 指令名
  exp: {
    type: NodeTypes.SIMPLE_EXPRESSION,
    content: 'true',
    isStatic: false
  },
  arg: undefined, // 参数
}
```
