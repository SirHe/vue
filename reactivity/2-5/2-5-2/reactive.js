// reactive.js
import { baseHandlers } from './baseHandlers.js'
import { collectionHandlers } from './collectionHandlers.js'
import { isObject } from './utils.js'

const TargetType = {
  INVALID: 0,
  COMMON: 1,
  COLLECTION: 2,
}

function targetTypeMap(rawType) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return TargetType.COMMON
    case 'Map':
    case 'Set':
    case 'WeakMap':
    case 'WeakSet':
      return TargetType.COLLECTION
    default:
      return TargetType.INVALID
  }
}

function getTargetType(value) {
  return targetTypeMap(toRawType(value))
}

export const reactive = (target) => {
  // 只能对对象类型的数据进行代理
  if (!isObject(target)) {
    return target
  }

  const targetType = getTargetType(target)
  if (targetType === TargetType.INVALID) {
    return target
  }
  const proxy = new Proxy(
    target,
    targetType === TargetType.COLLECTION ? collectionHandlers : baseHandlers
  )

  return proxy
}

export const RAW = Symbol('raw')

export const toRaw = (observed) => {
  const raw = observed?.[RAW]
  return raw ? toRaw(raw) : observed
}
