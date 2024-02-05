// effect.js
import { TrackOpTypes, TriggerOpTypes } from './constants.js'
import { ITERATE_KEY } from './baseHandlers.js'

let activeEffect = null
const targetMap = new WeakMap() // 存放数据与依赖函数（数据使用者）的关联关系

const triggerTypeMap = {
  [TriggerOpTypes.ADD]: [
    TrackOpTypes.GET,
    TrackOpTypes.HAS,
    TrackOpTypes.ITERATE,
  ],
  [TriggerOpTypes.DELETE]: [
    TrackOpTypes.GET,
    TrackOpTypes.HAS,
    TrackOpTypes.ITERATE,
  ],
  [TriggerOpTypes.SET]: [TrackOpTypes.GET],
}

// 依赖收集
export const track = (target, type, key) => {
  // obj -> prop -> type -> fn
  let propsMap = targetMap.get(target)
  // 属性
  if (!propsMap) {
    propsMap = new Map()
    targetMap.set(target, propsMap)
  }
  // 操作类型
  let typeMap = propsMap.get(key)
  if (!typeMap) {
    typeMap = new Map()
    propsMap.set(key, typeMap)
  }
  // 依赖函数
  let fnSet = typeMap.get(type)
  if (!fnSet) {
    fnSet = new Set()
    typeMap.set(type, fnSet)
  }
  fnSet.add(activeEffect)
}

// 派发更新
export const trigger = (target, type, key) => {
  // obj -> prop -> (triggerType - TrackOpType) -> fn
  const propsMap = targetMap.get(target)
  if (!propsMap) {
    return
  }
  const keys = [key]
  if (type === TriggerOpTypes.ADD || type === TriggerOpTypes.DELETE) {
    // 如果是添加或者删除需要手动通知 ITERATE_KEY 相关的依赖函数
    keys.push(ITERATE_KEY)
  }
  let fnSet = []
  for (let key of keys) {
    const typeMap = propsMap.get(key)
    if (!typeMap) {
      continue
    }
    // 根据修改数据类型，找对应会影响到的数据使用类型，进行精准通知
    const triggerTypes = triggerTypeMap[type]
    fnSet = triggerTypes.reduce((arr, type) => {
      arr.push(...(typeMap.get(type) || []))
      return arr
    }, [])
  }
  fnSet = new Set(fnSet)
  ;[...fnSet].forEach((fn) => fn())
}

// 代理依赖函数
export const effect = (fn) => {
  activeEffect = fn
  fn()
}
