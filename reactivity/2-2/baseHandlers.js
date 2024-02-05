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

// 说明：
// 在vue的源码中还考虑到了只读属性，也就是说如果对只读属性进行修改的话需要抛出错误提示，所以又提取了一层公共层 BaseReactiveHandler 用于存放取操作的拦截器，而对于存操作，根据只读属性和普通属性的不同表现分别编写了 ReadonlyReactiveHandler 和 MutableReactiveHandler。
// 我们这里先不考虑只读属性，所以会将 MutableReactiveHandler 中的代码合并到 BaseReactiveHandler 中。
