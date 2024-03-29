import { toRaw, toReactive, toReadonly } from './reactive.js'
import {
  ITERATE_KEY,
  MAP_KEY_ITERATE_KEY,
  track,
  trigger,
} from './effect.js'
import { ReactiveFlags, TrackOpTypes, TriggerOpTypes } from './constants.js'
import { capitalize, hasChanged, hasOwn, isMap, toRawType, getProto } from './utils.js'


const toShallow = (value) => value



function get(
  target,
  key,
  isReadonly = false,
  isShallow = false,
) {
  // #1772: readonly(reactive(Map)) should return readonly + reactive version
  // of the value
  target = target[ReactiveFlags.RAW]
  const rawTarget = toRaw(target)
  const rawKey = toRaw(key)
  if (!isReadonly) {
    if (hasChanged(key, rawKey)) {
      track(rawTarget, TrackOpTypes.GET, key)
    }
    track(rawTarget, TrackOpTypes.GET, rawKey)
  }
  const { has } = getProto(rawTarget)
  const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive
  if (has.call(rawTarget, key)) {
    return wrap(target.get(key))
  } else if (has.call(rawTarget, rawKey)) {
    return wrap(target.get(rawKey))
  } else if (target !== rawTarget) {
    // #3602 readonly(reactive(Map))
    // ensure that the nested reactive `Map` can do tracking for itself
    target.get(key)
  }
}

function has(this, key, isReadonly = false) {
  const target = this[ReactiveFlags.RAW]
  const rawTarget = toRaw(target)
  const rawKey = toRaw(key)
  if (!isReadonly) {
    if (hasChanged(key, rawKey)) {
      track(rawTarget, TrackOpTypes.HAS, key)
    }
    track(rawTarget, TrackOpTypes.HAS, rawKey)
  }
  return key === rawKey
    ? target.has(key)
    : target.has(key) || target.has(rawKey)
}

function size(target, isReadonly = false) {
  target = toRaw(target)
  !isReadonly && track(toRaw(target), TrackOpTypes.ITERATE, ITERATE_KEY)
  return Reflect.get(target, 'size', target)
}

function add(value) {
  value = toRaw(value)
  const target = toRaw(this)
  const proto = getProto(target)
  const hadKey = proto.has.call(target, value)
  if (!hadKey) {
    target.add(value)
    trigger(target, TriggerOpTypes.ADD, value)
  }
  return this
}

function set(key, value) {
  value = toRaw(value)
  const target = toRaw(this)

  let hadKey = target.has(key)
  if (!hadKey) {
    key = toRaw(key)
    hadKey = target.has(key)
  }
  const oldValue = target.get(key)
  target.set(key, value)
  if (!hadKey) {
    trigger(target, TriggerOpTypes.ADD, key)
  } else if (hasChanged(value, oldValue)) {
    trigger(target, TriggerOpTypes.SET, key)
  }
  return this
}

function deleteEntry(key) {
    const target = toRaw(this)
    let hadKey = target.has(key)
    if (!hadKey) {
      key = toRaw(key)
      hadKey = target.has(key)
    }
  
    const result = target.delete(key)
    if (hadKey) {
      trigger(target, TriggerOpTypes.DELETE, key)
    }
    return result
  }

function clear() {
  const target = toRaw(this)
  const hadItems = target.size !== 0
  const result = target.clear()
  if (hadItems) {
    trigger(target, TriggerOpTypes.CLEAR, undefined)
  }
  return result
}

function createForEach(isReadonly, isShallow) {
  return function forEach(
    this,
    callback,
    thisArg,
  ) {
    const observed = this 
    const target = observed[ReactiveFlags.RAW]
    const rawTarget = toRaw(target)
    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive
    !isReadonly && track(rawTarget, TrackOpTypes.ITERATE, ITERATE_KEY)
    return target.forEach((value, key) => {
      // important: make sure the callback is
      // 1. invoked with the reactive map as `this` and 3rd arg
      // 2. the value received should be a corresponding reactive/readonly.
      return callback.call(thisArg, wrap(value), wrap(key), observed)
    })
  }
}

function createIterableMethod(
  method,
  isReadonly,
  isShallow,
) {
  return function (
    this,
    ...args
  ) {
    const target = this[ReactiveFlags.RAW]
    const rawTarget = toRaw(target)
    const targetIsMap = isMap(rawTarget)
    const isPair =
      method === 'entries' || (method === Symbol.iterator && targetIsMap)
    const isKeyOnly = method === 'keys' && targetIsMap
    const innerIterator = target[method](...args)
    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive
    !isReadonly &&
      track(
        rawTarget,
        TrackOpTypes.ITERATE,
        isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY,
      )
    // return a wrapped iterator which returns observed versions of the
    // values emitted from the real iterator
    return {
      // iterator protocol
      next() {
        const { value, done } = innerIterator.next()
        return done
          ? { value, done }
          : {
              value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
              done,
            }
      },
      // iterable protocol
      [Symbol.iterator]() {
        return this
      },
    }
  }
}

function createReadonlyMethod(type) {
  return function (this, ...args) {
    return type === TriggerOpTypes.DELETE
      ? false
      : type === TriggerOpTypes.CLEAR
        ? undefined
        : this
  }
}

function createInstrumentations() {
  const mutableInstrumentations = {
    get(this, key) {
      return get(this, key)
    },
    get size() {
      return size(this)
    },
    has,
    add,
    set,
    delete: deleteEntry,
    clear,
    forEach: createForEach(false, false),
  }

  const shallowInstrumentations= {
    get(this, key) {
      return get(this, key, false, true)
    },
    get size() {
      return size(this)
    },
    has,
    add,
    set,
    delete: deleteEntry,
    clear,
    forEach: createForEach(false, true),
  }

  const readonlyInstrumentations= {
    get(this, key) {
      return get(this, key, true)
    },
    get size() {
      return size(this, true)
    },
    has(this, key) {
      return has.call(this, key, true)
    },
    add: createReadonlyMethod(TriggerOpTypes.ADD),
    set: createReadonlyMethod(TriggerOpTypes.SET),
    delete: createReadonlyMethod(TriggerOpTypes.DELETE),
    clear: createReadonlyMethod(TriggerOpTypes.CLEAR),
    forEach: createForEach(true, false),
  }

  const shallowReadonlyInstrumentations= {
    get(this, key) {
      return get(this, key, true, true)
    },
    get size() {
      return size(this, true)
    },
    has(this, key) {
      return has.call(this, key, true)
    },
    add: createReadonlyMethod(TriggerOpTypes.ADD),
    set: createReadonlyMethod(TriggerOpTypes.SET),
    delete: createReadonlyMethod(TriggerOpTypes.DELETE),
    clear: createReadonlyMethod(TriggerOpTypes.CLEAR),
    forEach: createForEach(true, true),
  }

  const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator]
  iteratorMethods.forEach(method => {
    mutableInstrumentations[method ] = createIterableMethod(
      method,
      false,
      false,
    )
    readonlyInstrumentations[method ] = createIterableMethod(
      method,
      true,
      false,
    )
    shallowInstrumentations[method ] = createIterableMethod(
      method,
      false,
      true,
    )
    shallowReadonlyInstrumentations[method ] = createIterableMethod(
      method,
      true,
      true,
    )
  })

  return [
    mutableInstrumentations,
    readonlyInstrumentations,
    shallowInstrumentations,
    shallowReadonlyInstrumentations,
  ]
}

const [
  mutableInstrumentations,
  readonlyInstrumentations,
  shallowInstrumentations,
  shallowReadonlyInstrumentations,
] = createInstrumentations()

function createInstrumentationGetter(isReadonly, shallow) {
  const instrumentations = shallow
    ? isReadonly
      ? shallowReadonlyInstrumentations
      : shallowInstrumentations
    : isReadonly
      ? readonlyInstrumentations
      : mutableInstrumentations

  return (
    target,
    key,
    receiver,
  ) => {
    
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly
    } else if (key === ReactiveFlags.RAW) {
      return target
    }

    return Reflect.get(
      hasOwn(instrumentations, key) && key in target
        ? instrumentations
        : target,
      key,
      receiver,
    )
  }
}

export const mutableCollectionHandlers = {
  get: createInstrumentationGetter(false, false),
}

export const shallowCollectionHandlers = {
  get: createInstrumentationGetter(false, true),
}

export const readonlyCollectionHandlers = {
  get:  createInstrumentationGetter(true, false),
}

export const shallowReadonlyCollectionHandlers =
  {
    get:  createInstrumentationGetter(true, true),
  }

function checkIdentityKeys(
  target,
  has,
  key,
) {
  const rawKey = toRaw(key)
  if (rawKey !== key && has.call(target, rawKey)) {
    const type = toRawType(target)
    console.warn(
      `Reactive ${type} contains both the raw and reactive ` +
        `versions of the same object${type === `Map` ? ` as keys` : ``}, ` +
        `which can lead to inconsistencies. ` +
        `Avoid differentiating between the raw and reactive versions ` +
        `of an object and only use the reactive version if possible.`,
    )
  }
}
