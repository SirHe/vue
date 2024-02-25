// baseHandlers.js
import { TrackOpTypes, TriggerOpTypes } from './constants.js'
import { reactive, toRaw, RAW, readonly } from './reactive.js'
import { track, trigger } from './effect.js'
import { isObject, isArray, hasOwn } from './utils.js'
export const ITERATE_KEY = Symbol('iterate')

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

export class BaseReactiveHandler {
  constructor(_isReadonly = false, _shallow = false) {
    this._isReadonly = _isReadonly
    this._shallow = _shallow
  }

  get(target, key, receiver) {
    const isReadonly = this._isReadonly,
      shallow = this._shallow
    if (key === RAW) {
      return target
    }
    if (!isReadonly) {
      track(target, TrackOpTypes.GET, key)
    }
    if (isArray(target) && hasOwn(arrayInstrumentations, key)) {
      return Reflect.get(arrayInstrumentations, key, receiver)
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
    const oldValue = target[key]
    const oldLength = isArray(target) ? target.length : 0
    const result = Reflect.set(target, key, value, receiver)
    const newLength = isArray(target) ? target.length : 0

    // 如果修改失败，就没必要执行后面的通知操作了
    if (!result) {
      return result
    }

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
