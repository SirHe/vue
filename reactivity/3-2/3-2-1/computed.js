import { effect, track, trigger } from './effect.js'
import { TrackOpTypes, TriggerOpTypes } from './constants.js'
import { isFunction, defaultFunction } from './utils.js'

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
