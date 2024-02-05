# 浅谈 Vue 响应式原理设计与实现

## 1、核心思路

vue 响应式原理本质上就是：在数据**被使用**的时候**自动**收集**数据的使用者**，在数据**更新**的时候**自动**通知这些数据的使用者。

在 vue 里面，数据的主要的使用者其实就是渲染函数，所以在渲染函数执行的时候进行依赖收集；在数据更新的时候，将之前收集到的依赖（渲染函数）拿出来重新执行一遍，这样渲染出新的页面了。

值得一提的是：广义上的数据使用，不仅仅包括读取数据，还包括修改数据，比如我们程序中声明的变量，我们常常会它进行读取和修改。但是我们这里所指的数据使用者**仅仅指取数据的用户（或者说模块），也就是我们前端框架中的视图层（UI 层）**，比如 vue 的 template、react 的 jsx，而细究数据的修改者一般是事件处理函数。

## 2、代码实现

### 2.1、环境准备

我们知道 template 编译的结果其实就是一个 render 函数，而 render 函数的调用结果其实就是一个虚拟 DOM，然后再进行虚拟 DOM 的对比，得到最小量更新，最后根据对比的结果精准地更新真实 DOM。

我们目前主要考虑的是响应式这部分内容，那么我们就先忽略编译器、虚拟 DOM diff 以及渲染器部分的内容。我们在 render 函数中直接进行 DOM 操作，渲染我们的视图。基本代码结构如下：

```html
<!-- index.html -->
<html lang="en">
  <body>
    <div id="app"></div>
    <script>
      // 渲染函数
      const render = () => {
        const dom = document.querySelector('#app')
        dom.innerHTML = data.a
      }

      // 响应式数据
      const data = { a: 'hello' }

      // 渲染页面
      render() // 实际上是vue帮我们调用render的，这里我们先自己手动调用一下
      setTimeout(() => {
        data.a = 'world'
        render() // 现在是手动调用render，最终期望的是自动
      }, 1000)
    </script>
  </body>
</html>
```

先实现一个最简单的，我们希望在 render 函数运行的时候进行依赖收集，收集 data.a 这个属性被 render 函数用到了；在 data.a 更新时，自动（目前是手动）重新调用 render，这样我们的视图更新了。

### 2.2、最简易版的实现

围绕响应式的核心：在数据被使用的时候收集使用者，在数据更新的时候通知使用者。而现在我们面临的第一个问题是：数据被读取了，但是我们不知道；数据更新了，我们也不知道。**那么怎么获得数据被读取和数据更新的感知能力呢？答案是对数据存取操作加一层代理**。后面我们再像使用原数据对象那样去**使用代理对象**，这样我们就具有了代理对象赋予我们的感知能力了。值得注意的是，我这里说的是**代理这种设计模式**，不是 Vue 里面的 Object.defineProperty 和 Proxy，**只不过 Object.defineProperty 和 Proxy 是 js 语言中常用的代理模式的实现方式**。

我们接下来选择使用 Proxy 来实现数据存取操作的代理。在 vue 中，生成代理对象的逻辑维护在 `reactive.ts`文件中，而通过 Proxy 创建代理对象**主要的处理逻辑在 handler 中**，所以 vue 又将这些 handler 抽离了出来，放在 `baseHandlers.ts`文件中。那么在 `reactive.ts`中就维护代理对象的创建相关处理逻辑（比如一些控制逻辑），而 `baseHandlers.ts`就维护对数据进行不同操作时的处理逻辑，我们也沿用这种方式。

开始正式编写代码之前，先做一个小小的说明：对于工具类函数，比如 isObject，isArray 等等，vue 源码中做法是放到 shared 这个单独的包里面，我们会放到 `utils.js` 这个文件中，最后这个在附录中统一提供 `utils.js` 这个文件。

```js
// reactive.js
import { BaseReactiveHandler } from './baseHandlers.js'
import { isObject } from './utils.js'

export const reactive = (target) => {
  // 只能对对象类型的数据进行代理
  if (!isObject(target)) {
    return target
  }

  const proxy = new Proxy(target, new BaseReactiveHandler())
  return proxy
}
```

```js
// baseHandlers.js
export class BaseReactiveHandler {}

// 说明：
// 在vue的源码中还考虑到了只读属性，也就是说如果对只读属性进行修改的话需要抛出错误提示，所以又提取了一层公共层 BaseReactiveHandler 用于存放取操作的拦截器，而对于存操作，根据只读属性和普通属性的不同表现分别编写了 ReadonlyReactiveHandler 和 MutableReactiveHandler。
// 我们这里先不考虑只读属性，所以会将 MutableReactiveHandler 中的代码合并到 BaseReactiveHandler 中。
```

对应改造一下我们 HTML 文件的结构

```html
<!-- index.html -->
<html lang="en">
  <body>
    <div id="app"></div>
    <script type="module">
      import { reactive } from './reactive.js'
      // 渲染函数
      const render = () => {
        const dom = document.querySelector('#app')
        dom.innerHTML = reactivityData.a
      }

      // 响应式数据
      const originalData = { a: 'hello' }
      const reactivityData = reactive(originalData)
      // 渲染页面
      render() // 实际上是vue帮我们调用render的，这里我们先自己手动调用一下
      setTimeout(() => {
        reactivityData.a = 'world'
        render() // 现在是手动调用render，最终期望的是自动
      }, 1000)
    </script>
  </body>
</html>
```

我们的最终目标是删掉 20 行的代码，效果保持不变。`reactive.js`我们就先这么简单的写着，后面我们再进行补充和完善，接下来我们编写 `baseHandlers.js`中读取数据的代理逻辑。

```js
// baseHandlers.js
const get = (target, key) => {
  // 依赖收集
  return target[key]
}

export class BaseReactiveHandler {
  get = get
}
```

第一个问题：根据前面的分析，依赖收集的内容其实就是：保存正在使用当前数据的函数。我们目前实现的是简易版本，保存依赖信息的数据结构会比较简单，可以简单直接写到 get 函数中。但是等到我们后面实现一个近似于 vue 的版本时，那个数据结构就会比较复杂，与之相应的数据存取逻辑也会比较复杂，而且将来在依赖收集过程中还会有暂停收集、延迟派发等一些控制逻辑，会导致当前模块压力过大。

还有一个更重要的问题：我们现在虽然可以感知到数据被使用了，但是我们现在**并不知道数据的使用者**是谁（也就是不知道是哪个函数在使用我们的数据）。

- 有一种方式，**我们可以通过 `arguments.callee` 来拿到当前环境函数，再通过 `caller` 去查找函数调用链**。为了方便我们在调用链上面进行查找，我们可能需要给 render 函数对象添加一个 Symbol 属性。但是这种方式比较麻烦，而且这种方式还会遇到一个问题，那就是不能传递延迟派发更新等配置信息。
- vue 使用的是另外一种方式，那就是类似于函数代理，提供一个 effct 函数，我们把需要进行依赖收集的函数传入到 effect 函数中，由 effect 函数帮我们执行。做这样一层代理之后，对于拿到依赖函数（数据的使用者）就是一件轻而易举的事情了。

#### 扩展（函数调用链）

```js
// function-caller.js
function a() {
  console.log(arguments.callee.name)
  console.log(arguments.callee.caller.caller.name)
}

function b() {
  a()
}

function c() {
  b()
}

c()
// a
// c
```

所以我们也采用 vue 的做法，编写一个单独的 effect 模块，来维护依赖收集和派发更新的逻辑。先编写一个简单结构，如下：

```js
// effect.js
let activeEffect = null

// 依赖收集
export const track = (target, key) => {}

// 派发更新
export const trigger = (target, key) => {}

// 代理依赖函数
export const effect = (fn) => {
  activeEffect = fn
  fn()
}
```

其实 track 与 trigger 的逻辑也十分简单，就是保存依赖函数和把依赖函数取出来运行一下。这里需要稍微设计一下的是依赖信息的保存结构，其实我们这个简易版也不复杂，就是两层 map，先通过 target 找到 key，再通过 key 找到 fn。实现如下：

```js
// effect.js
let activeEffect = null
const targetMap = new WeakMap() // 存放数据与依赖函数（数据使用者）的关联关系

// 依赖收集
export const track = (target, key) => {
  let propsMap = targetMap.get(target)
  if (!propsMap) {
    propsMap = new Map()
    targetMap.set(target, propsMap)
  }
  let fnSet = propsMap.get(key)
  if (!fnSet) {
    fnSet = new Set()
    propsMap.set(key, fnSet)
  }
  fnSet.add(activeEffect)
}

// 派发更新
export const trigger = (target, key) => {
  const propsMap = targetMap.get(target)
  const fnSet = propsMap?.get(key) || []
  ;[...fnSet].forEach((fn) => fn())
}

// 代理依赖函数
export const effect = (fn) => {
  activeEffect = fn
  fn()
}
```

写完了 effect 模块，我们 baseHandlers 模块剩下的部分就特别简单了，我们直接编写实现代码，如下：

```js
// baseHandlers.js
import { track, trigger } from './effect.js'

const get = (target, key) => {
  track(target, key)
  return target[key]
}

const set = (target, key, value) => {
  target[key] = value
  trigger(target, key)
}

export class BaseReactiveHandler {
  get = get
  set = set
}
```

然后再对应地改一下我们之前的 HTML，把 render 函数交给 effect 函数去执行。

```html
<!-- index.html -->
<html lang="en">
  <body>
    <div id="app"></div>
    <script type="module">
      import { reactive } from './reactive.js'
      import { effect } from './effect.js'
      // 渲染函数
      const render = () => {
        const dom = document.querySelector('#app')
        dom.innerHTML = reactivityData.a
      }

      // 响应式数据
      const originalData = { a: 'hello' }
      const reactivityData = reactive(originalData)
      // 渲染页面
      effect(render) // 交给effect函数去代理执行
      setTimeout(() => {
        reactivityData.a = 'world'
      }, 1000)
    </script>
  </body>
</html>
```

OK，到目前为止，我们响应式最最最简易的版本就实现了。目前我们已经把核心的结构搭建起来了，跑通了基本的流程。接下来就是一步一步完善的过程了。但是这里会报一个错误，有兴趣的朋友可以了解一下，我搜索了一下没有找到相关的资料。

![Alt text](截屏 2024-01-20 下午 5.08.31.png)

#### 扩展：Object.defineProperty 和 Proxy 的区别

这两个 API 的本质区别是：**Object.defineProperty 叫做数据劫持，Proxy 叫做数据代理**。

数据劫持和数据代理有什么区别呢？数据劫持本质上**没有产生新的对象**，只是在原来的对象上的一些操作设置拦截器，进行了劫持，插入我们的依赖收集和派发更新逻辑；而数据代理是**通过原数据生成了一个新的代理数据**，在代理数据的代理方法中去插入我们的依赖收集和派发更新逻辑。换句话说：数据劫持的方式并没有生成新数据，使用劫持处理后的原数据就具有响应式；而数据代理的方式是生成了新的代理数据（生成了一个新的代理对象），**使用代理数据就具有响应式，而使用原数据是不具有响应式的**。

其实我们在使用 proxy 对原数据进行代理之后，**原数据对于代理而言就是一块内存**，用于真实存储数据的地方。所以原数据与代理数据的关系是：原数据是代理数据的内存，代理数据的读写最终会落到原数据身上。当然原数据也是一块独立的数据内存，一个普通的对象类型的变量，完全可以单独使用，只不过，正常情况下，如果原数据被代理之后，我们就不再直接使用这块数据了。**而数据劫持的方式是将数据保存在了函数闭包身上**，被劫持的数据对象不再具有数据存储能力，也就是内存功能。

**区分原数据和代理数据是十分重要的**，因为在接下来的细节处理中，我们会遇到很多自然情况下拿到的是原数据，需要我们手动处理成代理数据的情况。为了防止后面绕晕，需要始终记住的一点是：使用原数据是不具有响应式的，使用代理数据才具有响应式。

### 2.3、解决几个小的核心问题

简易版实现之后，我本来是想接着写数组代理那部分内容的，但是仔细想了想还是打算先进行小的核心内容的完善，比如：原数据设置了拦截器时，拦截器中的 this 指向问题、对象深层代理、代理数据的其他使用方式、过期的旧依赖、多个 render 与 render 嵌套的情况、render 中对数据同时进行读写操作时等这些小的核心问题。这部分也相对比较简单，而且对后面聊数组代理处理那部分也具有奠基的作用，所以我们就先拿这部分来练练手。

#### 2.3.1、原数据设置了拦截器时，拦截器中的 this 指向问题

测试如下代码：

```html
<!-- index.html -->
<html lang="en">
  <body>
    <div id="app"></div>
    <script type="module">
      import { reactive } from './reactive.js'
      import { effect } from './effect.js'
      // 渲染函数
      const render = () => {
        const dom = document.querySelector('#app')
        dom.innerHTML = reactivityData.sum
      }

      const reactivityData = reactive({
        a: 1,
        b: 2,
        get sum() {
          return this.a + this.b
        },
      })
      // 渲染页面
      effect(render) // 交给effect函数去代理执行
      setTimeout(() => {
        reactivityData.a = 3
      }, 1000)
    </script>
  </body>
</html>
```

1s 之后，我们将 a 的值修改为 3，然后我们发现页面上 sum 的值并没有更新成 5，**这里我们很显然是希望 sum 的值去自动更新**。为了解释这个问题，我们先来看下面这个测试的例子：

```js
// test1.js
const originalData = {
  a: 1,
  b: 2,
  get sum() {
    console.log(this === originalData)
    return this.a + this.b
  },
}
originalData.sum
// true
```

在这例子中，原数据中 sum 属性设置了 get 拦截器方法，通过测试结果可以发现，拦截器方法中的 this 指向的就是原数据。有了这一层铺垫，相信下面这部分的测试结果你应该也很容易理解了。

```js
// test2.js
const originalData = {
  a: 123,
  b: 456,
  get sum() {
    console.log(this === originalData, this === reactivityData)
    return this.a + this.b
  },
}
const reactivityData = new Proxy(originalData, {
  get(target, key) {
    console.log('get', key)
    return target[key]
  },
})

reactivityData.sum
// get sum
// true false
```

根据打印结果，我们可以发现，this 指向 originalData，**而读取原始数据的属性 a、b，自然不会进行 track**。那么我们现在要做的其实就是想办法看能不能把 this 指向 reactivityData，这样我们再通过 this.a 访问 a 的时候，就可以被 Proxy 的 get 拦截到，进而完成依赖收集。

我们知道如果是函数的话，那其实是很简单的，就是使用 bind、call、apply 任意一种就可以改变 this 指向。但是这里是对象的属性拦截器，所以不能直接使用这些方法。仔细查阅一下文档，其实还是有的，就是使用 Reflect。先看下面这段测试：

```js
// test3.js
const obj = {}
Object.defineProperty(obj, 'a', {
  get() {
    return this.abc
  },
})
const a = Reflect.get(obj, 'a', { abc: 'hello' })
console.log(a)
// hello
```

这其实和函数的 call 方法差不多，只不过 call 方法把 this 放到了第一个参数的位置，因为函数的参数数量是不确定的。

而**正好 Proxy 的拦截器中也给我们暴露了当前代理对象，放在了最后一个参数的位置**。所以基于这两点，我们就可以优化一下我们之前的拦截器，让它支持原数据中设置拦截器的情况。代码如下：

```js
// 其他代码省略
const get = (target, key, receiver) => {
  track(target, key)
  const value = Reflect.get(target, key, receiver)
  return value
}

const set = (target, key, value, receiver) => {
  const result = Reflect.set(target, key, value, receiver)
  // 如果修改失败，就没必要执行后面的通知操作了
  if (!result) {
    return result
  }
  trigger(target, key)
  return result
}
// 其他代码省略
```

OK，到此我们的第一个小问题就解决了，后面的代理拦截器中我们也需要沿用这种做法，使用 Reflect 改变一下 this 的指向。

##### 扩展：在 js 中，函数的 this 指向问题

在 js 中，函数内的 this 指向问题其实可以一句话概括：**普通函数 this 指向调用者，箭头函数 this 沿用外部 this**。其实本质就这么简单，只不过在 js 中函数可以传来传去，加上一些异步延迟调用、嵌套调用、框架代理调用等复杂的使用情况，导致了我们确定函数**最终的直接调用者**是谁比较困难，进而导致我们确定 this 比较困难。

举一个例子：

```js
// test4.js
function fn() {
  return this.a
}

const obj1 = {
  a: 'hello',
}

const obj2 = {
  a: 'world',
}

obj1.fn = fn
const a1 = obj1.fn()
console.log(a1, 'obj1')

obj2.fn = obj1.fn
const a2 = obj2.fn()
console.log(a2, 'obj2')

console.log(fn === obj1.fn, fn === obj2.fn)
// hello obj1
// world obj2
// true true
```

这个例子可以很好的说明普通函数的 this 取决于函数的直接调用者。

#### 2.3.2、考虑对象深层代理

解决这个问题很简单，**关键是需要区分代理对象和原始对象**（操作代理对象具有响应式，操作原始对象是没有响应式的），大家可以测试如下代码：

```html
<!-- index.html -->
<html lang="en">
  <body>
    <div id="app"></div>
    <script type="module">
      import { reactive } from './reactive.js'
      import { effect } from './effect.js'
      import { sleep } from './utils.js'

      const render = () => {
        const dom = document.querySelector('#app')
        dom.innerHTML = `
              <ul>
                <li>${obj3.obj1.a}</li>
                <li>${obj3.b}</li>
              <ul>`
      }

      const obj1 = { a: 123 }
      const obj2 = { obj1, b: 456 }
      const obj3 = reactive(obj2)
      effect(render)

      const work = async () => {
        await sleep(1000)
        obj3.b = 'world'
        await sleep(1000)
        const obj = obj3.obj1
        obj.a = 'hello'
        console.log(obj1.a, obj === obj1)
      }
      work()
    </script>
  </body>
</html>
```

发现 1s 之后 `456` 变成了 `world`，但是 3s 之后 `123` 没有变成 `hello`，控制台打印结果为：`hello true`。没有变成 `hello`的原因就是：**我们通过 `obj3.obj1` 拿到的这个对象 obj 不是一个代理对象，而是一个原始对象（就是 obj1）**，那么对它进行操作自然没有响应式。所以问题出在 get 拦截器，我们需要在 get 中加一层判断，如果取到的值是对象，就使用 reactive 转变成代理对象返回。那么我们后面拿到都是代理对象，然后对代理对象进行 set 等操作时，自然就具有了响应式。

```js
// baseHandlers.js
import { track, trigger } from './effect.js'
import { reactive } from './reactive.js'
import { isObject } from './utils.js'

const get = (target, key) => {
  track(target, key)
  const value = Reflect.get(target, key, receiver)
  if (isObject(value)) {
    return reactive(value)
  }
  return value
}

// 其他代码省略省略
```

测试一下没问题，数据深层代理问题就解决啦。

#### 2.3.3、代理数据的其他使用方式

我们目前为止，只考虑了 get 和 set 也就获取数据和修改数据这两种数据的使用方式，那么数据还有没有其他使用方式呢？答案是肯定的，接下来我们来考虑一下数据还有哪些使用方式，然后我们再顺便思考一下不同的数据变更方式会对哪些不同数据使用方式造成影响。

##### 完整的数据使用方式

在 js 中对象其实也可以看作是一种 map 的数据结构，也就是 key-value 的键值对。而对于 map 这种数据结构的使用，我们关注的重心一般是：**使用 key 进行存取数据、删除 key 以及相关 value、遍历 key 以及相关 value、判断 key 是否存在**。简而言之：**关于 map 的使用，我们关心的是对 key 以及 key 对应的 value 进行增、删、改、查、遍历和检测**。所以我们应该配置对象属性增、删、改、遍历和检测的相关拦截器，这样就可以完整地代理对象全部的基本使用操作了。

通过翻阅文档可知相关操作对应的拦截器如下：
增-set
删-deleteProperty
改-set
查-get
遍历-ownKeys
检测-has

接下来就可以丰富我们的拦截器了，代码如下：

```js
// baseHandlers.js
export const ITERATE_KEY = Symbol('iterate')
// 其他代码省略省略
const has = (target, key) => {
  track(target, key)
  return Reflect.has(target, key)
}

const ownKeys = (target) => {
  // 这个拦截器没有key，因为对象属性遍历这个动作并不属于任何一个属性
  // 但是我们知道我们依赖的存储结构，是以key来存放对应的set的，所以需要我们自己构造一个key传进去。
  // 使用symbol主要是为了解决命名冲突的问题
  track(target, ITERATE_KEY)
  return Reflect.ownKeys(target)
}

const deleteProperty = (target, key) => {
  const isHas = target.hasOwnProperty(key)
  const result = Reflect.deleteProperty(target, key)
  if (isHas && result) {
    // 因为如果对象不存在这个属性，那么对这个属性的删除也是成功的，所以这里需要加上hasOwnProperty判断
    trigger(target, key)
  }
  return result
}

export class BaseReactiveHandler {
  get = get
  set = set
  has = has
  ownKeys = ownKeys
  deleteProperty = deleteProperty
}
```

需要注意下面这两点：

- **遍历对象属性的这个操作并不属于对象的任何一个属性**，所以 ownKeys 拦截器中，并不会传一个具体的 key 这个参数过来。但是我们的依赖函数需要保存在对象属性 key 下的 set 集合中。这里有两种处理方式，一种是再开一个 WeakMap，使用对象做 key，存储遍历的依赖函数的 set 集合；另外一种是构造一个特殊的 key，直接将依赖函数存储到我们现在的数据结构中。显然第二种方式更好，改动小而且好维护，同样的 vue 也是选用这种方式。使用这种方式唯一需要注意的问题就是命名冲突的问题，所以这里使用 Symbol 来构造 key。
- 删除一个对象不具有的属性是成功的，比如：`delete ({}).a`返回结果是 true，所以我们需要加一层 hasOwnPrope

##### 数据变更对数据使用造成的影响

既然我们都已经考虑到了代理数据的所有使用方式了，那么我们就可以顺便考虑一下不同的数据修改方式（改信息）会对不同的数据使用方式（读信息）造成哪些影响。首先我们先简单分个类：

- 数据修改方式：增（set）、删（deleteProperty）、改（set）
- 数据使用方式：查（get）、遍历（ownKeys）、检测（has）

根据开发经验告诉我们，这种信息可以做一个枚举来存储，防止硬编码。代码如下：

```js
// constants.js
export const TrackOpTypes = {
  GET: 'get', // 查
  HAS: 'has', // 检测
  ITERATE: 'iterate', // 遍历
}

export const TriggerOpTypes = {
  SET: 'set', // 改
  ADD: 'add', // 增
  DELETE: 'delete', // 删
}
```

根据这些方式，我们不难分析出改信息与读信息的对应影响关系如下：

增-查、遍历、检测
删-查、遍历、检测
改-查

同样的，这些关系我们可以建一个 map 来维护，代码如下：

```js
// effect.js
const triggerTypeMap = {
  [TriggerOpTypes.ADD]: [
    TrackOpTypes.GET,
    TrackOpTypes.HAS,
    TrackOpTypes.ITERATE,
  ],
  [TriggerOpTypes.DELETE]: [
    TrackOpTypes.GET,
    TrackOpTypes.HAS,
    TrackOpTypes.ITERATE,
  ],
  [TriggerOpTypes.SET]: [TrackOpTypes.GET],
}
```

接下来就需要修改我们的依赖函数存储的数据结构了。之前是：**对象-属性-依赖函数** （`obj -> key -> fnSet`），那么现在更细粒度地考虑了不同修改类型会影响到的不同的使用类型，所以我们需要修改数据结构为：**对象-属性-操作类型-依赖函数**（`obj -> key -> type -> fnSet`），也就是更细粒度地通知依赖函数。

所以我们首先需要完善我们的代理逻辑（`baseHandlers.js`），将数据操作信息传递也收集起来，代码如下：

```js
// baseHandlers.js
import { TrackOpTypes, TriggerOpTypes } from './constants.js'
import { reactive } from './reactive.js'
import { track, trigger } from './effect.js'
import { isObject } from './utils.js'
export const ITERATE_KEY = Symbol('iterate')

const get = (target, key, receiver) => {
  track(target, TrackOpTypes.GET, key)
  const value = Reflect.get(target, key, receiver)
  if (isObject(value)) {
    return reactive(value)
  }
  return value
}

const set = (target, key, value, receiver) => {
  const type = target.hasOwnProperty(key)
    ? TriggerOpTypes.SET
    : TriggerOpTypes.ADD
  const result = Reflect.set(target, key, value, receiver)
  if (!result) {
    return result
  }
  trigger(target, type, key)
  return result
}

const has = (target, key) => {
  track(target, TrackOpTypes.HAS, key)
  return Reflect.has(target, key)
}

const ownKeys = (target) => {
  track(target, TrackOpTypes.ITERATE, ITERATE_KEY)
  return Reflect.ownKeys(target)
}

const deleteProperty = (target, key) => {
  const isHas = target.hasOwnProperty(key)
  const result = Reflect.deleteProperty(target, key)
  if (isHas && result) {
    trigger(target, TriggerOpTypes.DELETE, key)
  }
  return result
}

export class BaseReactiveHandler {
  get = get
  set = set
  has = has
  ownKeys = ownKeys
  deleteProperty = deleteProperty
}
```

这里需要注意的一个问题是：在 js 语言层面并没有帮我们做增加和修改的区分，都是使用同一个拦截器 set，所有需要我们手动去区分。其实区分的逻辑也很简单，就判断一下修改前的数据有没有这个属性，有就是修改，没有就是新增。接下来我们需要改造依赖函数的存储数据结构以及相应的存取数据逻辑，如下：

```js
// effect.js
import { TrackOpTypes, TriggerOpTypes } from './constants.js'
import { ITERATE_KEY } from './baseHandlers.js'

let activeEffect = null
const targetMap = new WeakMap() // 存放数据与依赖函数（数据使用者）的关联关系

const triggerTypeMap = {
  [TriggerOpTypes.ADD]: [
    TrackOpTypes.GET,
    TrackOpTypes.HAS,
    TrackOpTypes.ITERATE,
  ],
  [TriggerOpTypes.DELETE]: [
    TrackOpTypes.GET,
    TrackOpTypes.HAS,
    TrackOpTypes.ITERATE,
  ],
  [TriggerOpTypes.SET]: [TrackOpTypes.GET],
}

// 依赖收集
export const track = (target, type, key) => {
  // obj -> prop -> type -> fn
  let propsMap = targetMap.get(target)
  // 属性
  if (!propsMap) {
    propsMap = new Map()
    targetMap.set(target, propsMap)
  }
  // 操作类型
  let typeMap = propsMap.get(key)
  if (!typeMap) {
    typeMap = new Map()
    propsMap.set(key, typeMap)
  }
  // 依赖函数
  let fnSet = typeMap.get(type)
  if (!fnSet) {
    fnSet = new Set()
    typeMap.set(type, fnSet)
  }
  fnSet.add(activeEffect)
}

// 派发更新
export const trigger = (target, type, key) => {
  // obj -> prop -> (triggerType - TrackOpType) -> fn
  const propsMap = targetMap.get(target)
  if (!propsMap) {
    return
  }
  const keys = [key]
  if (type === TriggerOpTypes.ADD || type === TriggerOpTypes.DELETE) {
    // 如果是添加或者删除需要手动通知 ITERATE_KEY 相关的依赖函数
    keys.push(ITERATE_KEY)
  }
  let fnSet = []
  for (let key of keys) {
    const typeMap = propsMap.get(key)
    if (!typeMap) {
      continue
    }
    // 根据修改数据类型，找对应会影响到的数据使用类型，进行精准通知
    const triggerTypes = triggerTypeMap[type]
    fnSet = triggerTypes.reduce((arr, type) => {
      arr.push(...(typeMap.get(type) || []))
      return arr
    }, [])
  }
  fnSet = new Set(fnSet)
  ;[...fnSet].forEach((fn) => fn())
}

// 代理依赖函数
export const effect = (fn) => {
  activeEffect = fn
  fn()
}
```

值得注意的是：我们知道对于 add 和 delete 操作是会影响我们的遍历的结果的。我们遍历的依赖收集在一个特殊的 key（ITERATE_KEY）映射中，所以这需要我们手动把这些依赖拿出来，然后去加入到我们的通知名单中。

最后再简单测一测：

```html
<!-- index.html -->
<html lang="en">
  <body>
    <div id="app">
      <div id="box1"></div>
      <div>----------</div>
      <div id="box2"></div>
      <div>----------</div>
      <div id="box3"></div>
    </div>
    <script type="module">
      import { reactive } from './reactive.js'
      import { effect } from './effect.js'
      import { sleep } from './utils.js'
      const render1 = () => {
        const dom = document.querySelector('#box1')
        dom.innerHTML = Object.values(reactivityData1).join(',')
      }
      const render2 = () => {
        const dom = document.querySelector('#box2')
        dom.innerHTML = 'a' in reactivityData2
      }
      const render3 = () => {
        const dom = document.querySelector('#box3')
        dom.innerHTML = reactivityData3.a
      }

      // 1、遍历
      const reactivityData1 = reactive({ a: 'hello' })
      // 2、属性检测
      const reactivityData2 = reactive({ b: 'world' })
      // 3、删除属性
      const reactivityData3 = reactive({ a: 'hello' })
      effect(render1)
      effect(render2)
      effect(render3)
      const work = async () => {
        await sleep(1000)
        reactivityData1.b = 'world'
        await sleep(1000)
        reactivityData2.a = 'hello'
        await sleep(1000)
        delete reactivityData3.a
      }
      work()
    </script>
  </body>
</html>
```

测试结果完全符合预期，到此我们的数据关注粒度就足够细了，达到了 vue 源码级别。**不仅关注使用了数据的哪个属性，而且还关注到了具体的操作类型。**

#### 2.3.4、过期的旧依赖

我们前面的依赖收集关注点都是在不断的 set，也就是添加的情况。虽然 set 可以帮我们去重，解决重复收集的问题。那么有没有什么情况下我们是需要删除 set 中的依赖函数呢？答案是有的。一开始我想到是删除属性的情况，其实删除的情况下是没有问题，因为等后面再 set 这个之前被删除的属性，实际上是需要派发更新的，这没问题。**这个问题体现在一个比较特殊的场景：切换分支**。测试如下代码：

```html
<!-- index.html -->
<html lang="en">
  <body>
    <div id="app"></div>
    <script type="module">
      import { reactive } from './reactive.js'
      import { effect } from './effect.js'
      import { sleep } from './utils.js'

      const render = () => {
        console.log('render')
        const dom = document.querySelector('#app')
        dom.innerHTML = reactivityData.a ? reactivityData.b : reactivityData.c
      }

      const originalData = { a: true, b: 'hello', c: 'world' }
      const reactivityData = reactive(originalData)
      effect(render)

      const work = async () => {
        await sleep(1000)
        console.log(1)
        reactivityData.c = 'hello'
        await sleep(1000)
        console.log(2)
        reactivityData.a = false
        await sleep(1000)
        console.log(3)
        reactivityData.b = 'world'
      }
      work()
    </script>
  </body>
</html>
```

测试结果如下：
![Alt text](截屏 2024-01-20 下午 8.05.14.png)

在这个例子中，我们的希望是这样的，当 reactivityData.a 为 true 时，无论 reactivityData.c 怎么改变都不应该重新运行 render；当 reactivityData.a 为 false 时，reactivityData.b 同理。

我们会发现，刚开始的时候先改变 reactivityData.c，render 确实不会重新执行。但是当我们改变 reactivityData.a 为 false 时，问题就出现了。此时改变 reactivityData.b，发现 render 会重新运行。简单分析一下就会发现：**这就是因为我们没有删除之前收集到 reactivityData.b 的依赖**。

所以我们正确的循环过程应该是这样的：最开始 effect 帮我们执行 render，此时进行依赖收集（收集数据使用方式与 render 的关联关系）；等到后面修改了数据进行派发更新，此时又将之前收集到的依赖函数（render）拿出来重新运行，而此时再次运行 render 的时候，应该重新收集依赖。也就是说：**每次重新 render 都应该重新收集依赖**。

所以当某个 render 在运行时，我们需要从 targetMap，这个总的依赖关系树中找到所有的存有当前 render 的 set，并将当前 render 删除。现在面临的一个难题是，我们如何找到存放当前的 render 的所有 set。有两种方案，第一种是遍历 targetMap 所有的 set；第二种就是以 render 为 key，set 为 value，以 map 的形式记录 render 被保存到了哪些 set 中。

很显然第二总方式更加高效，而是 vue 选择的也是第二种方式，不过 vue 对第二种方式做了进一步优化，也就是直接以数组的方式将 set 集合记录在 render 函数对象的一个属性上，这样就不用单独开一个 map 了，我们也采用这种方式。同时我们再专门写一个函数 cleanupEffect 来维护旧依赖的删除逻辑。代码如下：

```js
// effect.js
// 其他代码省略
export const track = (target, type, key) => {
  // 其他代码省略
  fnSet.add(activeEffect)
  if (!activeEffect.deps) {
    activeEffect.deps = []
  }
  activeEffect.deps.push(fnSet) // 把当前记录render的set加入到render的deps中
}

export const trigger = (target, type, key) => {
  // 其他代码省略
  ;[...fnSet].forEach((fn) => {
    cleanupEffect(fn) // 每次重新执行render之前，先删除render的旧依赖
    fn()
  })
}

function cleanupEffect(effect) {
  const { deps } = effect
  if (!deps?.length) {
    return
  }
  for (let i = 0; i < deps.length; i++) {
    deps[i].delete(effect)
  }
  deps.length = 0
}
```

接下来再测试就是 render 两次了，旧依赖的缓存问题就解决了，当然这也是为下一小节做一个小小的铺垫。

#### 2.3.5、多个 render 与 render 嵌套的情况

##### 2.3.5.1、多个 render

我们之前只是考虑单个依赖函数的情况，也就是一个 render 函数的情况，接下来我们考虑多个依赖函数的情况。看一下我们的之前的代码会不会有问题，测试代码如下：

```html
<!-- index.html -->
<html lang="en">
  <body>
    <div id="app">
      <div id="box1"></div>
      <div>----------</div>
      <div id="box2"></div>
    </div>
    <script type="module">
      import { reactive } from './reactive.js'
      import { effect } from './effect.js'
      import { sleep } from './utils.js'
      const render1 = () => {
        const dom = document.querySelector('#box1')
        dom.innerHTML = reactivityData1.a
      }
      const render2 = () => {
        const dom = document.querySelector('#box2')
        dom.innerHTML = reactivityData2.b
      }

      const reactivityData1 = reactive({ a: 'hello' })
      const reactivityData2 = reactive({ b: 'world' })

      effect(render1)
      effect(render2)

      const work = async () => {
        await sleep(1000)
        reactivityData1.a = 'world'
        await sleep(1000)
        reactivityData1.a = 'hello'
      }
      work()
    </script>
  </body>
</html>
```

上面这段测试代码很显然我们期望的是，1s 之后 render1 渲染的文字为 world，再等 1s 之后渲染的文字又变成 hello。但是实际上我们第一次修改是成功的，而第二次修改却没有成功。其原因就是我们目前处理 activeEffect 的方式有问题。我们现在是 effect 接收到一个 render，就将它赋值给全局变量 activeEffect，这样在 track 的时候就可以记录这个 render 了。但是当 trigger 的时候，实际上会重新运行 render，进而进行重新 track。**问题就在重新 track 的时候，此时我们想要收集的是 render1，而由于上一步操作执行了 effect(render2)，所以此时 activeEffect 的值为 render2**，进而导致我们收集到了错误的依赖 render2。

也就是说：我们需要在 track 运行 render 之前，修改 activeEffect 为当前 render 即可。代码如下：

```js
// effect.js
// 其他代码省略
export const trigger = (target, type, key) => {
  // 其他代码省略
  ;[...fnSet].forEach((fn) => {
    activeEffect = fn // 修改 activeEffect 为当前 render
    cleanupEffect(fn)
    fn()
  })
}
```

测试一下问题解决。

##### 2.3.5.2、render 嵌套

接下来我们考虑 render 嵌套的情况。我们知道使用组件化的开发方式，组件嵌套组件的情况是十分常见的，这也就意味着存在 effect 嵌套的情况。比如如下测试代码：

```html
<!-- index.html -->
<html lang="en">
  <body>
    <div id="app">
      <div id="outer"></div>
      <div>-----------</div>
      <div id="inner"></div>
    </div>
    <script type="module">
      import { reactive } from './reactive.js'
      import { effect } from './effect.js'
      import { sleep } from './utils.js'

      const innerRender = () => {
        const dom = document.querySelector('#inner')
        dom.innerHTML = 'inner-' + reactivityInnerData.a
      }

      const outerRender = () => {
        const dom = document.querySelector('#outer')
        effect(innerRender)
        dom.innerHTML = 'outer-' + reactivityOuterData.a
      }

      const reactivityOuterData = reactive({ a: 'hello' })
      const reactivityInnerData = reactive({ a: 'hello' })
      effect(outerRender)
      const work = async () => {
        await sleep(1000)
        reactivityInnerData.a = 'world'
        await sleep(1000)
        reactivityOuterData.a = 'world'
      }
      work()
    </script>
  </body>
</html>
```

发现一秒钟之后，inner 对应的 hello 变成了 world，但是再等一秒钟，我们却没有发现 outer 对应的 hello 变成了 world。仔细分析一下可以发现，其实是因为我们 effect 收集完 innerRender 的依赖之后，我们将全局函数 activeEffect 赋值成了 innerRender，这时候再运行剩下的代码 `dom.innerHTML = 'outer-' + reactivityOuterData.a` 实际上收集到的是 innerRender，很显然此时我们希望收集的是 outerRender。

产生这个问题的根本原因就是我们函数可能是嵌套调用的，也就是使用栈的方式存储的，把需要运行的函数压入栈顶，将执行完毕的函数退栈。**如果函数存在嵌套，那么就是按照执行顺序依次入栈，然后再依次出栈**。而我们现在的 activeEffect 是使用单一的一个变量来存储，导致 activeEffect 与函数在运行时失调。

所以解决方案到这里也呼之欲出了，那就用栈来存储 activeEffect，这样就能保证 activeEffect 与函数在运行时的对应关系了。（**render 开执行，activeEffect 入栈；render 执行结束，activeEffect 出栈**）。代码如下：

```js
// effect.js
let activeEffect = null
const effectStack = []

// 其他代码省略
export const track = (target, type, key) => {
  // 其他代码省略
  ;[...fnSet].forEach((fn) => {
    activeEffect = fn
    cleanupEffect(fn)
    effectStack.push(fn)
    fn()
    effectStack.pop()
    activeEffect = effectStack.at(-1)
  })
}

export const effect = (fn) => {
  activeEffect = fn
  effectStack.push(fn)
  fn()
  effectStack.pop()
  activeEffect = effectStack.at(-1)
}
// 其他代码省略
```

这样就没有问题了。接下来我们做一个小小的优化，我们发现 effect 中和 track 的末尾部分代码有高度的重复。这时候我们就可以进行向上再抽象一下，我们目前需要做的其实是两件事情：1、运行 render（也就是这里的 fn）；2、管理 activeEffect。所以有一种比较简单的方式就是使用包装函数。代码如下：

```js
// effect.js
let activeEffect = null
const effectStack = []

// 其他代码省略
export const track = (target, type, key) => {
  // 其他代码省略
  ;[...fnSet].forEach((fn) => fn())
}

// 代理依赖函数
export const effect = (fn) => {
  const fnWrapper = () => {
    activeEffect = fnWrapper
    cleanupEffect(fnWrapper)
    effectStack.push(fnWrapper)
    fn()
    effectStack.pop()
    activeEffect = effectStack.at(-1)
  }
  fnWrapper()
}
// 其他代码省略
```

这里会有点绕，其中外界传进来的依赖函数 fn 又以闭包的形式保存在了 fnWrapper。而我们现在收集到的依赖是 fnWrapper，而不再是 fn，这样等到后面派发更新时，调用的就是 fnWrapper，最后测试一下也是没有问题的。其实看过 vue 源码的朋友应该发现了，vue 不是这么处理的，它是专门建了一个 effect 类来管理 render，activeEffect 等。我们这里的场景还没有那么复杂，所以我们先这样简单处理，等到下一小节，处理同时读写问题是我们再优化成 vue 源码的那种方式。

#### 2.3.6、render 中对数据同时进行读写操作时

我们知道运行 trigger，它会去运行 render。那么如果 render 中有数据修改操作，这会导致去运行 trigger，而 trigger 又运行 render，进而导致无限循环调用。

而在 render 中赋值的情况大概可以分为三种：普通赋值、自增（减）和数组 push 等操作。测试如下：

```html
<!-- test1.html -->
<html lang="en">
  <body>
    <div id="app"></div>
    <script type="module">
      import { reactive } from './reactive.js'
      import { effect } from './effect.js'

      const render = () => {
        const dom = document.querySelector('#app')
        dom.innerHTML = reactivityData.a
        reactivityData.a = 'world'
      }

      const reactivityData = reactive({ a: 'hello' })
      effect(render)
    </script>
  </body>
</html>
```

```html
<!-- test2.html -->
<html lang="en">
  <body>
    <div id="app"></div>
    <script type="module">
      import { reactive } from './reactive.js'
      import { effect } from './effect.js'

      const render = () => {
        const dom = document.querySelector('#app')
        dom.innerHTML = reactivityData.a++
      }

      const reactivityData = reactive({ a: 1 })
      effect(render)
    </script>
  </body>
</html>
```

```html
<!-- test3.html -->
<html lang="en">
  <body>
    <div id="app"></div>
    <script type="module">
      import { reactive } from './reactive.js'
      import { effect } from './effect.js'

      const render = () => {
        const dom = document.querySelector('#app')
        dom.innerHTML = reactivityData[0]
        reactivityData.push(2)
      }

      const reactivityData = reactive([1])
      effect(render)
    </script>
  </body>
</html>
```

测试结果和我们前面预测的一模一样，第三种数组的情况我这里可以简单提一下，原因就是 push 这个操作里面包含了对 length 的读取和写入两个操作。那么我们清楚了问题所在，接下来解决策略也比较好想了，**那无非就是在 track 的时候不要 trigger，或者在 trigger 的时候不要 track，只要保存它们两个互拆运行即可**。

最简单的做法就是在运行依赖函数 render 的时候检查一下，该 render 函数是不是 activeEffect，也就是正在被收集依赖的函数，如果是，那就取消运行。代码如下：

```js
// effect.js
// 其他代码省略
// 派发更新
export const trigger = (target, type, key) => {
  // 其他代码省略
  ;[...fnSet].forEach((fn) => fn !== activeEffect && fn())
}
// 其他代码省略
```

简单测试一下，发现其实此时就已经可以解决第三种情况，数组 API（push、unshift 等等）触发的对于 length 属性的既读又写的问题。不过 vue 解决这个问题是使用暂停依赖收集和恢复依赖收集来解决。这种解决方式我个人感觉优点多余，不过等到后面提到数组的部分，我们再具体来聊一聊 vue 对于数组方法使用时产生的既读又写的情况的做法。

#### 2.3.7、拦截器拦截不到的特殊情况

通过 Object.defineProperty 直接修改代理对象的数据，操作代理不到，比如：

```js
// test.js
const obj = { a: 1 }

const proxyObj = new Proxy(obj, {
  set(obj, prop, value) {
    console.log('set')
    obj[prop] = value
  },
})

Object.defineProperty(proxyObj, 'a', { value: 2 })
console.log(proxyObj.a) // 2
```

通过测试可以发现，只打印了 2，并没有打印 set，所以可以说明使用 Object.defineProperty 这种方式去修改代理对象的值，值会被更改，但是操作不会被代理到。我们目前没有办法解决这个问题，这里只是提及一下有这种情况存在。

### 2.4、数组的响应式处理

接下来我们需要开始考虑一下数组这种数据结构的数据相关的代理我们需要做些什么。同样的，我们的思路还是**先分析数据有哪些使用方式，然后在通过在代理对象上拦截这些使用方式，从而实现对数组数据的相关代理**。

首先我们可以想到的是，在 JavaScript 这门语言中，Array 是 Object 的子类，也就说**数组其实本质上也是对象**。**我们使用的游标（数组索引）最终会被转换成字符串，然后作为 key 也就是对象的属性再去操作数组对象进行数据存取**。所以我们现在对于数组与索引相关的操作（增、删、改、遍历（指的是对象属性 key 的遍历，不是数组元素的遍历）和检测）实际上是可以正常代理了，我们可以简单测试一下：

```html
<!-- test.html -->
<html lang="en">
  <body>
    <div id="app"></div>
    <script type="module">
      import { reactive } from './reactive.js'
      import { effect } from './effect.js'
      import { sleep } from './utils.js'
      const render = () => {
        const dom = document.querySelector('#app')
        console.log('render')
        dom.innerHTML = `
        <div>数组元素：${Object.values(arr).join('-')}</div>
        <div>是否包含0这个游标：${arr.hasOwnProperty(0)}</div>
        `
      }

      const arr = reactive([1, 2])
      effect(render)
      const work = async () => {
        await sleep(1000)
        arr[2] = 3
        await sleep(1000)
        delete arr[0]
        await sleep(1000)
        arr[2] = 6
      }
      work()
    </script>
  </body>
</html>
```

测试结果完全符合我们的预期，也就是**把数组当成普通对象使用，到目前为止我们的响应式是完全 OK 的**。那么我们接下来需要考虑的就是与普通对象不同的、数组独有的使用数据方式。数组这种数据结构主要考虑这几种使用方式：数组的遍历、数组的相关方法以及数组属性间的联动。

#### 2.4.1、属性与属性的联动（length 属性与游标属性相互关联）

对于数组这种数据结构的使用方式就是：**拿游标（或者说索引）去存取数据，同时还维护一个长度（length）数据来作为边界限制**。我们仔细分析一下会发现，**普通对象的属性之间变化是完全独立的、互不干扰的**，也就是说我更改普通对象的 a 属性，实际上是完全不会影响对象的 b 属性的。但是数组中就有一个特别的地方就是： **length 属性与元素游标属性相互关联**。比如说：`arr[5] = 6`这个操作可能会改变 `arr`的 length，如果说它的长度小于 6 的话；同样的，`arr.length = 3`这个操作也可能会改变 `arr[5]`访问的结果。

目前我们的响应式系统是：改 length 属性，派发 length 属性的更新；改游标属性，派发游标属性的更新，没有考虑属性间的关联关系。测试下面的例子，很显然是不具有响应式的：

```html
<!-- test.html -->
<html lang="en">
  <body>
    <div id="app">
      <div id="box1"></div>
      <div>----------</div>
      <div id="box2"></div>
    </div>
    <script type="module">
      import { reactive } from './reactive.js'
      import { effect } from './effect.js'
      import { sleep } from './utils.js'
      const render1 = () => {
        const dom = document.querySelector('#box1')
        let htmlStr = ''
        for (let i = 0; i < arr1.length; i++) {
          htmlStr += `<div>${arr1[i]}</div>`
        }
        dom.innerHTML = htmlStr
      }

      const render2 = () => {
        const dom = document.querySelector('#box2')
        dom.innerHTML = arr2[4]
      }

      const arr1 = reactive([1, 2, 3, 4, 5])
      const arr2 = reactive([1, 2, 3, 4, 5])
      effect(render1)
      effect(render2)
      const work = async () => {
        await sleep(1000)
        arr1[5] = 6
        arr2.length = 3
      }
      work()
    </script>
  </body>
</html>
```

在上面这两个 render（render1 和 render2）测试用例中，**从数据使用者的角度出发，很显然肯定是需要重新 render 的，因为数据都变了**，但是结果是没有重新 render。

接下来我们把这段关联关系补上，也就是如果 length 变化导致了元素删除，那么我们需要手动通知那些被删除的元素；如果设置元素导致了 length 变化，那么我们需要手动通知一下 length。代码如下：

```js
// 其他代码省略
import { isArray } from './utils.js'

const set = (target, key, value, receiver) => {
  const type = target.hasOwnProperty(key)
    ? TriggerOpTypes.SET
    : TriggerOpTypes.ADD
  const oldValue = target[key]
  const oldLength = isArray(target) ? target.length : 0
  const result = Reflect.set(target, key, value, receiver)
  const newLength = isArray(target) ? target.length : 0

  trigger(target, type, key)

  // 游标影响length
  if (isArray(target) && oldLength !== newLength && key !== 'length') {
    trigger(target, TriggerOpTypes.SET, 'length')
  }

  // length影响游标
  if (isArray(target) && key === 'length' && newLength < oldLength) {
    for (let i = newLength; i < oldLength; i++) {
      trigger(target, TriggerOpTypes.DELETE, i.toString())
    }
  }
  return result
}
// 其他代码省略
```

再测试一下上面的那个例子，发现运行结果就完美了。

#### 2.4.2、数组遍历

我们可以通过以下三种常见的方式遍历数组元素：

- **通过 length 配合循环去取**
- **通过 Object.keys、for...in 等先遍历所有游标，再通过游标依次去取**
- **通过 for...of 遍历数组迭代器去取**

通过 length 的方式，我们刚刚处理好了；通过先遍历游标，再通过游标依次去取的方式，这种方式就是普通对象的遍历方式，我们之前在处理普通对象时就处理好了。而第三种方式实际上是通过调用数组的迭代器去遍历的，而数组的迭代器被保存在了 `Symbol.iterator` 这个特殊的属性上。所以我们使用 for...of 去遍历数组时，收集到的依赖是 `Symbol.iterator`、length 和所有的游标。有了这些依赖，其实 for...of 这种遍历方式（也就是通过迭代的方式进行遍历），我们的响应式也是 OK 的，大家可以自己测试一下。

到目前为止，我们对于数组的遍历的情况就处理完了，接下来我们需要去考虑通过数组方法去使用数组数据的情况。

##### 扩展（for...in 与 for...of）

for...in 和 for...of 的本质区别可以用一句话概括：**for...in 遍历的是对象以及原型的可枚举的 key，for...of 遍历的是迭代器**。

在 js 中，迭代器就是一个实现了[迭代协议](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Iteration_protocols)的对象。比如：

```js
const obj = {
  i: 0,
  sum: 0,
  next() {
    this.i++
    this.sum = this.sum + this.i
    return {
      value: this.sum,
      done: this.i > 3,
    }
  },
  [Symbol.iterator]() {
    return this
  },
}

for (let item of obj) {
  console.log(item) // 输出0, 1, 3, 6
}
```

#### 2.4.3、数组相关方法

数组相关方法有很多，我们首先来思考一下目前我们的响应式系统可以正常的代理相关方法吗？我们来测试一下，比如先来一个最简单的 at 方法：

```html
<!-- test.html -->
<html lang="en">
  <body>
    <div id="app"></div>
    <script type="module">
      import { reactive } from './reactive.js'
      import { effect } from './effect.js'
      const render = () => {
        const dom = document.querySelector('#app')
        dom.innerHTML = arr.at(0)
      }

      const arr = reactive([1, 2, 3])
      effect(render)
      setTimeout(() => {
        arr[0] = 6
      }, 1000)
    </script>
  </body>
</html>
```

我们先来分析一下，我们会收集到哪些依赖。首先，我们访问了数组对象的 at 属性（`arr.at`），所以 at 先被收集到。接下来 `arr.at` 是一个方法，我们对这个方法发生调用。我们现在并不知道 at 方法的内部做了什么，但是我们可以推测的出是：`arr.at(0)` 一定会访问数组对象的 `0` 这个属性。所以一定会收集到一个为 `0` 的依赖。

接下来我们调试一下看一下实际结果，发现基本上和我们之前推断的差不多，只是多收集了一个 length 属性依赖。
![Alt text](截屏 2024-01-14 下午 4.18.48.png)

接下来我们分析这三个依赖（`at`、`length`、`0`）是否应该被收集。

首先 `0` 不用说，我们思考一下 `at` 这个方法是否应该被收集呢？有的朋友可能会这么考虑，我们既然都已经收集到了 `0` 这个属性依赖，只要将来 `0` 这个游标对应的数据发生了变化，再派发 `0` 更新不就实现界面的更新了。其实把 at 属性依赖收集起来，主要考虑到 at 这个方法可能被改写的这个特殊情况。其实准确来说，这里的 length 的收集是重复了，因为我们已经手动实现了游标和 length 的绑定。不过总的来说，即使依赖收集重复了，我们最后在进行通知的时候，会把所有的依赖函数汇总丢到一个 set 中进行去重，这里我们就不细究了。

通过 at 数组方法的分析，发现一般情况下对于数组方法，我们目前的响应式是没什么问题的，即使有重复的依赖收集，我们也能够通过 set 进行去重。接下来我们考虑一种特殊的会产生问题的情况，在测试之前，我们加一个小优化，那就是我们的 reactive.js 这个文件。我们加一个缓存来进行防止重复代理的问题，代码如下：

```js
// reactive.js
import { BaseReactiveHandler } from './baseHandlers.js'
import { isObject } from './utils.js'

const targetMap = new WeakMap() // 代理对象缓存

export const reactive = (target) => {
  // 只能对对象类型的数据进行代理
  if (!isObject(target)) {
    return target
  }

  if (targetMap.get(target)) {
    return targetMap.get(target)
  }

  const proxy = new Proxy(target, new BaseReactiveHandler())
  targetMap.set(target, proxy)
  return proxy
}
```

```html
<!-- test.html -->
<html lang="en">
  <body>
    <div id="app"></div>
    <script type="module">
      import { reactive } from './reactive.js'
      import { effect } from './effect.js'
      const render = () => {
        const dom = document.querySelector('#app')
        dom.innerHTML = `
        ${arr.includes(1)}
        -----------------
        ${arr.includes(obj)}
        -----------------
        ${arr.includes(proxyObj)}
        -----------------
        ${arr[2] === proxyObj}
        `
      }

      const obj = { a: 3 }
      const proxyObj = reactive(obj)
      const arr = reactive([1, 2, obj])
      effect(render)
    </script>
  </body>
</html>
```

通过测试结果：true、false、true、true，我们可以发现问题所在了。对于数组查找方法，**我们使用的时候一般都是丢原元素进去查找**，但是由于我们默认是进行深层代理（**对象数据类型递归转化成代理对象**），导致我们通过 arr[2]拿到的使用经过了代理处理的代理对象。这样自然就匹配不上，导致查找不到。知道了问题所在，解决这个问题也就变得简单了。我们处理这种匹配问题的方法是：将比对的双方转化成同一种类型（原始数据或者代理数据），最常见的就是**字符串的大小写模糊匹配**，我们一般将两边都转化成大写或者小写，再进行匹配比对（**也就是先把数据往同一个方向转化，转化之后再匹配**）。与 includes 类似还有 indexOf 和 lastIndexOf，我们一起来处理一下：

首先我们想要将我们的匹配逻辑加进去，进而影响匹配结果，那么我们需要使用**装饰器模式**，使用我们自己的方法在原始方法的基础上进行包装，类似于 react 的高级组件，也就是我们首先需要改写原始方法。首先想到的是写三个 if 判断，但是我们知道可以用数组来优化 if 写法，所以代码如下：

```js
// baseHandlers.js
// 其他代码省略
const get = (target, key, receiver) => {
  track(target, TrackOpTypes.GET, key)
  if (isArray(target) && ['includes', 'indexOf', 'lastIndexOf'].includes(key)) {
    return (...args) => {
      const arr = toRaw(target)
      for (let i = 0, l = target.length; i < l; i++) {
        track(arr, TrackOpTypes.GET, i + '')
      }
      // 1、先找一遍
      const result = Array.prototype[key].call(arr, ...args)
      // 2、在原数组中找
      if (result === -1 || result === false) {
        return Array.prototype[key].call(arr, ...args.map(toRaw))
      }
      return result
    }
  }
  const value = Reflect.get(target, key, receiver)
  if (isObject(value)) {
    return reactive(value)
  }
  return value
}
// 其他代码省略
```

看懂上面这段代码需要一点点功底，我简单解释一下。

- 当读取数组的 includes、indexOf、lastIndexOf 这三个方法的其中一个时，会进入这个 if 条件，然后得到的是我们返回的箭头函数。也就是说 `arr.includes` 现在得到的是我们的箭头函数，后面 `arr.includes()` 调用的也是我们的箭头函数。
- 那么我们 includes 的逻辑就是像前面分析的那样，就是要把数据往同一种方向转化（vue 采用的是都转成原始数据），转化之后再匹配。值得注意的是，转成原始数据后，对元素数据的操作将失去代理，所以我们不要忘了手动收集一下依赖。

接下来我们的重心转变成如何拿到原始数据这个问题上，在上面的代码中，我用了一个 toRaw 方法（目前还没有实现这个方法），这个方法也是 vue 提供的一个工具方法，用于将响应式对象转成普通对象。如果了解过虚拟 dom 的朋友应该会有一些思路，我仔细想想，其实我们的响应式对象是我们通过原始对象加工得来的，现在的问题就是在加工的时候没有把原始对象保存起来，导致我们现在找不到了，那么我们只要把原始对象保存起来不就好了吗？

提到这里，有的朋友可能会很自然地想到创建一个 map，使用 key-value 的形式将原始对象保存起来。这种方式可以实现，但是了解虚拟 dom 的朋友就会想到另外一种更加简单的方式，那就是直接作为一个属性挂载在响应式对象身上（真实 dom 也是以属性的方式挂在虚拟 dom 身上）。**而在对象身上添加自定义属性必须要考虑的一个问题是：防止属性命名冲突**，所以我们这里又使用 Symbol 来作为属性名。代码如下：

```js
// reactive.js
// 其他代码省略
export const RAW = Symbol('raw')
export const toRaw = (observed) => {
  const raw = observed?.[RAW]
  return raw ? toRaw(raw) : observed
}
// 其他代码省略
```

同时我们的 get 方法也需要进行对应的支持，也就是读取 RAW 属性时，直接返回原对象。

```js
// baseHandlers.js
import { RAW } from './reactive.js'
// 其他代码省略
const get = (target, key, receiver) => {
  if (key === RAW) {
    return target
  }
  // 其他代码省略
}
// 其他代码省略
```

再测试一下之前的那个例子发现就没什么问题了。接下来，我们再往前走一步，再抽象一下我们的代码，优化一下我们的代码结构。首先我们回顾一下我们之前的思路，数组与普通对象的不同之处在于遍历和数组特有的方法，遍历的情况我们都已经处理到了，其实本质就是把游标属性与 length 属性的关联关系加上；而数组方法有太多太多，我们一个一个分析也不太现实，因为我们毕竟是学习 vue 框架，不是在做一个 vue 框架产品。

**而无论是数组的什么方法，只要不能自然的实现响应式，我们的处理方法都是使用装饰器设计模式的思路，再上面进行包装一层**。所以我们可以这样抽象，我们建立一个集合，把需要特殊处理的方法加入到这个集合中，每一次 get 代理进来时，查看这个 key 是否在集合中，如果在就使用装饰器。而为了方便快速查找，我们可以把集合优化成 map 结构。代码如下：

```js
// baseHandlers.js
import { hasOwn } from './utils.js'
const createArrayInstrumentations = () => {
  const instrumentations = {}
  ;['includes', 'indexOf', 'lastIndexOf'].forEach((key) => {
    instrumentations[key] = function (...args) {
      const arr = toRaw(this)
      for (let i = 0, l = this.length; i < l; i++) {
        track(arr, TrackOpTypes.GET, i + '')
      }
      // 1、先找一遍
      const result = Array.prototype[key].call(arr, ...args)
      // 2、在原数组中找
      if (result === -1 || result === false) {
        return Array.prototype[key].call(arr, ...args.map(toRaw))
      }
      return result
    }
  })
  return instrumentations
}
const arrayInstrumentations = createArrayInstrumentations()
// 其他代码省略
const get = (target, key, receiver) => {
  if (key === RAW) {
    return target
  }
  track(target, TrackOpTypes.GET, key)
  if (isArray(target) && hasOwn(arrayInstrumentations, key)) {
    return Reflect.get(arrayInstrumentations, key, receiver)
  }
  const value = Reflect.get(target, key, receiver)
  if (isObject(value)) {
    return reactive(value)
  }
  return value
}
// 其他代码省略
```

测试也是 OK 的，这样改造之后我们代码的可扩展性就好很多了，**如果将来发现还有其他的方法需要特殊处理，我们只需要在 createArrayInstrumentations 这个方法上加逻辑即可，添加新的数组方法属性到 instrumentations 对象身上即可，这样的代码结构也是符合我们的开闭原则的**。

我们如果瞄一眼 vue 的源码，可以发现除了对 'includes'、'indexOf'、'lastIndexOf' 这三个方法进行了特殊处理之外，还对 'push'、'pop'、'shift'、'unshift'、'splice' 这几个方法进行了特殊处理。这五个方法主要是因为对数组进行了既读又写的操作，而同时读写会导致依赖收集和派发更新交替进行从而导致死循环。因为我们之前考虑了数据同时读写的情况，所以这里我们就不需要再额外处理了。大家可以自行测试一下，我测试了一下这些方法是没有什么问题。

### 2.5、总结回顾

到目前为止，我们的响应式系统就比较完善了，可以代理普通对象以及数组对象的所有操作了。接下来，我们总结回顾一下：

首先我们还是从我们响应式的核心出发：**在数据被使用的时候自动收集数据的使用者，在数据更新的时候自动通知这些数据的使用者**。为了做到**自动**，我们需要使用代理的设计模式，**对数据操作进行代理**。

接下来我们从数据的实际使用出发，分析普通对象会有哪些使用方式（**增、删、改、查、遍历和检测**），进而完整地代理这些使用方式，实现普通对象的响应式。

然后我们再分析数组对象，使用同样的思路，分析数组有哪些使用方式。分析发现数组既可以像普通对象那样使用，又有一些自己独特的使用方式，比如：遍历、数组方法。深入研究数组的遍历时发现**数组的 length 属性与游标属性实际上是具有关联关系的**，通过加上这段关联关系逻辑我们处理了所有遍历情况的响应式代理。后面分析数组方法的使用是发现了一个问题：深层代理导致数组的查找方法在匹配对象类型时匹配失败，进而查找不到结果，然后通过 `增加一次原数组遍历` 来解决了这两个问题。

总的来说，我们学习响应式的核心还是在于体会响应式系统的设计思想，比如如果让你去实现一个数据与视图绑定的功能，你会怎么做？vue 的响应式系统为我们提供了一种思路，而 react 的 setState 又为我们提供了另外一种思路。无论是 vue 的响应式系统，还是 react 的 setState **本质上都是在做数据代理**，只有代理了数据所有操作，我们的程序才对数据的变更具有感知能力。感知了数据的变化之后，vue 通过使用**观察者模式**实现自动地通知数据使用者，而 react 是在对应的 fiber 上打上一个 tag，这样在下一次 react 循环检测的时候就可以被检测到，进而进行处理。vue 是主动通知去更新，而 react 是被循环检测到标记被动通知更新。**无论是 vue 还是 react，都实现了数据与界面的绑定，进而减去了开发者的数据渲染的心智负担，进而开发者的精力就可以更加专注地聚焦在数据的维护，其实程序的核心也是数据（数据结构）和数据转换（算法）**。而一些边边角角的内容只是作为开阔一下我们的视野，了解一下 api 的使用，训练一下我们的思维，不是我们学习 vue 响应式的重点。

## 3、其他响应式 API 的实现

### 3.1、ref

实现我们前面的响应式系统之后，实现 ref 这个 API 其实就变得特别简单了。总的来说就是：在读取 value 属性的时候进行依赖收集，在修改 value 属性的时候派发更新。具体代码如下：

```js
// ref.js
import { track, trigger } from './effect.js'
import { TrackOpTypes, TriggerOpTypes } from './operations.js'
import { reactive } from './reactive.js'
import { isObject } from './utils.js'

export function ref(value) {
  return {
    get value() {
      track(this, TrackOpTypes.GET, 'value')
      return isObject(value) ? reactive(value) : value
    },
    set value(newValue) {
      value = newValue
      trigger(this, TriggerOpTypes.SET, 'value')
    },
  }
}
```

大家可以简单测试一下，应该是没有什么问题的。

### 3.2、computed

我们知道**计算属性抽象来看其实就是一个函数**（**传入依赖，return 数据转换结果**），我们通过运行这个函数就可以得到计算属性的值。于是结合计算属性 API 使用的特点我们可以简单写出如下代码：

```js
// computed.js
function computed(fn) {
  return {
    get value() {
      return fn()
    },
  }
}
```

#### 3.2.1、响应式

这样写会存在一些问题，我们先解决一个最重要的问题：可以发现我们目前的计算属性是没有响应式的。首先与 ref 一样，我们需要使用 track 收集计算属性的使用者。代码如下：

```js
// computed.js
export function computed(fn) {
  return {
    get value() {
      track(obj, TrackOpTypes.GET, 'value')
      return fn()
    },
  }
}
```

接下来会发现，计算属性与普通响应式数据不同的是：**修改数据的方式不同**。对于普通响应式数据，我们是通过直接修改数据本身进而修改了数据；而对于计算属性这种结构，我们是通过修改依赖数据来间接修改计算属性的值。（有的朋友可能会想到计算属性可以配置 set，但其实**计算属性的 set 并不能成计算属性值的直接修改因素**。**计算属性这种结构就决定了：它的值的直接修改因素只能是依赖数据**。）

所以当依赖数据发生变化的时候，我们希望可以通知计算属性，进行重新计算。结合前面实现的响应式系统，我们可以写出如下代码：

```js
// computed.js
export function computed(fn) {
  const obj = {
    get value() {
      track(obj, TrackOpTypes.GET, 'value')
      return fn()
    },
  }

  effect(() => {
    trigger(obj, TriggerOpTypes.SET, 'value')
    fn()
  })

  return obj
}
```

通过 effect 与 依赖数据建立响应式联系，当依赖数据发生变化，我们的响应式系统会自动运行依赖函数，结合计算属性数据修改特点可以得知，此时就是派发更新的时机。目前我们的 computed 响应式是 OK 的，大家可以自己测试一下，测试代码如下：

```html
<!-- index.html -->
<html lang="en">
  <body>
    <div id="app"></div>
    <script type="module">
      import { reactive } from './reactive.js'
      import { computed } from './computed.js'
      import { effect } from './effect.js'

      const render = () => {
        const dom = document.querySelector('#app')
        dom.innerHTML = computedData.value
      }

      const reactivityData1 = reactive({ a: 'hello' })
      const reactivityData2 = reactive({ a: 'world' })

      const computedData = computed(
        () => `${reactivityData1.a} ${reactivityData2.a}`
      )
      effect(render)

      setTimeout(() => {
        reactivityData1.a = 'hello1'
      }, 1000)
    </script>
  </body>
</html>
```

#### 3.2.2 结果缓存

我们现在还存在一个问题，那就是没有读取计算属性的值，都会进行一次计算，我们需要增加一层缓存，代码如下：

```js
export function computed(fn) {
  let value,
    dirty = true
  const obj = {
    get value() {
      track(obj, TrackOpTypes.GET, 'value')
      if (dirty) {
        value = fn()
        dirty = false
      }
      return value
    },
  }

  effect(() => {
    trigger(obj, TriggerOpTypes.SET, 'value')
    fn()
    dirty = true
  })

  return obj
}
```

关于计算属性，它的值具有两个重要的特性：**惰性计算与结果缓存**。惰性计算指的是：**当依赖数据发生变化之后，并不会立即进行重新计算，而是等到使用到的时候才会去计算**；而结果缓存指的是：**取值操作增加一层缓存处理**，不过需要增加缓存有效性的维护处理。

### 3.3、watch

```js
function watch(source, cb, options = {}) {
  let getter
  if (isFunction(source)) {
    getter = source
  } else {
    getter = () => traverse(source)
  }
  let oldValue, newValue
  const job = () => {
    newValue = effectFn()
    cb(newValue, oldValue)
    oldValue = newValue
  }
  const effectFn = effect(() => getter(), {
    lazy: true,
    scheduler: job,
  })
  if (options.immediate) {
    job()
  } else {
    oldValue = effectFn()
  }
}
```

### 3.4、watchEffect、watchSyncEffect、watchPostEffect

立即运行一个函数，同时响应式地追踪其依赖，并在依赖更改时重新执行。

第一个参数就是要运行的副作用函数。这个副作用函数的参数也是一个函数，用来注册清理回调。清理回调会在该副作用下一次执行前被调用，可以用来清理无效的副作用，例如等待中的异步请求 (参见下面的示例)。

第二个参数是一个可选的选项，可以用来调整副作用的刷新时机或调试副作用的依赖。

默认情况下，侦听器将在组件渲染之前执行。设置 flush: 'post' 将会使侦听器延迟到组件渲染之后再执行。详见回调的触发时机。在某些特殊情况下 (例如要使缓存失效)，可能有必要在响应式依赖发生改变时立即触发侦听器。这可以通过设置 flush: 'sync' 来实现。

### 3.5、readonly

接受一个对象 (不论是响应式还是普通的) 或是一个 ref，返回一个原值的只读代理。

## 4、响应式相关工具函数的实现

### 4.1、toRef 与 toRefs

这个两个 API 主要用于解决解构会导致响应式丢失的问题。我们先编写一个辅助方法：propertyToRef。

```js
function propertyToRef(source, key, defaultValue) {
  const val = source[key]
  return isRef(val) ? val : new ObjectRefImpl(source, key, defaultValue)
}

// isRef 的实现思路很简单，就是在创建 Ref 对象的时候创建一个特殊的属性，也就是手动打上一个标记
export function isRef(r) {
  return !!(r && r.__v_isRef === true)
}

class ObjectRefImpl {
  __v_isRef = true

  constructor(_object, _key, _defaultValue) {
    this._object = _object
    this._key = _key
    this._defaultValue = _defaultValue
  }

  get value() {
    const val = this._object[this._key]
    return val === undefined ? this._defaultValue : val
  }

  set value(newVal) {
    this._object[this._key] = newVal
  }
}
```

toRef 函数的实现：

```js
export function toRef(source, key, defaultValue) {
  if (isRef(source)) {
    return source
  } else if (isFunction(source)) {
    return new GetterRefImpl(source)
  } else if (isObject(source) && arguments.length > 1) {
    return propertyToRef(source, key, defaultValue)
  } else {
    return ref(source)
  }
}

class GetterRefImpl {
  __v_isRef = true
  constructor(_getter) {
    this._getter = _getter
  }
  get value() {
    return this._getter()
  }
}
```

toRefs 函数实现如下：

```js
export function toRefs(object) {
  const ret = isArray(object) ? new Array(object.length) : {}
  for (const key in object) {
    ret[key] = propertyToRef(object, key)
  }
  return ret
}
```

由于 toRef 与 toRefs 比较简单，我就直接贴源码了。

### toValue

将值、refs 或 getters 规范化为值。这与 unref() 类似，不同的是此函数也会规范化 getter 函数。如果参数是一个 getter，它将会被调用并且返回它的返回值。

```js
toValue(1) //       --> 1
toValue(ref(1)) //  --> 1
toValue(() => 1) // --> 1
```

```js
export function toValue(source) {
  return isFunction(source) ? source() : unref(source)
}

export function unref(ref) {
  return isRef(ref) ? ref.value : ref
}
```

### isProxy、isReactive、isReadonly

实现思路与 isRef 类似，这里就不再赘述了。

## 附录

```js
// utils.js
export const isObject = (value) => value != null && typeof value === 'object'
export const isArray = Array.isArray
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (val, key) => hasOwnProperty.call(val, key)
```
