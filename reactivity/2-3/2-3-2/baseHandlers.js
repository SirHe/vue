// baseHandlers.js
import { reactive } from './reactive.js'
import { track, trigger } from './effect.js'
import { isObject } from './utils.js'

const get = (target, key, receiver) => {
  track(target, key)
  const value = Reflect.get(target, key, receiver)
  if (isObject(value)) {
    return reactive(value)
  }
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

export class BaseReactiveHandler {
  get = get
  set = set
}
