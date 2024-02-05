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
  // 如果修改失败，就没必要执行后面的通知操作了
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
