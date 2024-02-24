// baseHandlers.js
import { TrackOpTypes, TriggerOpTypes } from './constants.js'
import { reactive } from './reactive.js'
import { track, trigger } from './effect.js'
import { isObject, isArray } from './utils.js'
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
