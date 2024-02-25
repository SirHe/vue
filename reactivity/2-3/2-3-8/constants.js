// constants.js
export const TrackOpTypes = {
  GET: 'get', // 查
  HAS: 'has', // 检测
  ITERATE: 'iterate', // 遍历
}

export const TriggerOpTypes = {
  SET: 'set', // 改
  ADD: 'add', // 增
  DELETE: 'delete', // 删
}

export const ReactiveFlags = {
  SKIP: '__v_skip',
  IS_REACTIVE: '__v_isReactive',
  IS_READONLY: '__v_isReadonly',
  IS_SHALLOW: '__v_isShallow',
  RAW: '__v_raw',
}
