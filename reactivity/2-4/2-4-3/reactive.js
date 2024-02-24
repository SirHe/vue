// reactive.js
import { BaseReactiveHandler } from './baseHandlers.js'
import { isObject } from './utils.js'

export const reactive = (target) => {
  // 只能对对象类型的数据进行代理
  if (!isObject(target)) {
    return target
  }

  const proxy = new Proxy(target, new BaseReactiveHandler())
  return proxy
}

export const RAW = Symbol('raw')

export const toRaw = (observed) => {
  const raw = observed?.[RAW]
  return raw ? toRaw(raw) : observed
}
