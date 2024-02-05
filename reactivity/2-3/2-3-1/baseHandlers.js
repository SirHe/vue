// baseHandlers.js
import { track, trigger } from './effect.js'

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

export class BaseReactiveHandler {
  get = get
  set = set
}
