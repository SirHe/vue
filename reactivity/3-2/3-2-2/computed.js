import { effect, track, trigger } from './effect.js'
import { TrackOpTypes, TriggerOpTypes } from './constants.js'
import { isFunction, defaultFunction } from './utils.js'

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

const normalizedParams = (getterOrOptions) => {
  let getter, setter
  if (isFunction(getterOrOptions)) {
    getter = getterOrOptions
    setter = defaultFunction
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set || defaultFunction
  }
  return { getter, setter }
}
