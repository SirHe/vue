// baseHandlers.js
import { TrackOpTypes, TriggerOpTypes } from './constants.js'
import { reactive, readonly } from './reactive.js'
import { track, trigger } from './effect.js'
import { isObject } from './utils.js'
export const ITERATE_KEY = Symbol('iterate')

export class BaseReactiveHandler {
  constructor(_isReadonly = false, _shallow = false) {
    this._isReadonly = _isReadonly
    this._shallow = _shallow
  }

  get(target, key, receiver) {
    const isReadonly = this._isReadonly,
      shallow = this._shallow
    if (!isReadonly) {
      track(target, TrackOpTypes.GET, key)
    }
    const value = Reflect.get(target, key, receiver)
    if (shallow) {
      return value
    }
    if (isObject(value)) {
      return isReadonly ? readonly(value) : reactive(value)
    }
    return value
  }

  set(target, key, value, receiver) {
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

  has(target, key) {
    track(target, TrackOpTypes.HAS, key)
    return Reflect.has(target, key)
  }

  ownKeys(target) {
    track(target, TrackOpTypes.ITERATE, ITERATE_KEY)
    return Reflect.ownKeys(target)
  }

  deleteProperty(target, key) {
    const isHas = target.hasOwnProperty(key)
    const result = Reflect.deleteProperty(target, key)
    if (isHas && result) {
      trigger(target, TriggerOpTypes.DELETE, key)
    }
    return result
  }
}

class MutableReactiveHandler extends BaseReactiveHandler {
  constructor(shallow = false) {
    super(false, shallow)
  }
}

export const mutableHandlers = new MutableReactiveHandler()
export const shallowReactiveHandlers = new MutableReactiveHandler(true)

class ReadonlyReactiveHandler extends BaseReactiveHandler {
  constructor(shallow = false) {
    super(true, shallow)
  }

  set(target, key) {
    return true
  }

  deleteProperty(target, key) {
    return true
  }
}

export const readonlyHandlers = new ReadonlyReactiveHandler()
export const shallowReadonlyHandlers = new ReadonlyReactiveHandler(true)
