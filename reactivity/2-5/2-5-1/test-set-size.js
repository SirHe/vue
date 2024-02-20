// test-set-size.js
const proxySet = new Proxy(new Set([1, 2, 3]), {
  get(target, property, receiver) {
    // 其他代码省略
    return Reflect.get(target, property, receiver)
  },
})
// console.log(proxySet.size)
proxySet.add(4)
