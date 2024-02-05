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
