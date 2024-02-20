// test-arr-length.js
const proxyArr = new Proxy([1, 2, 3], {
  get(target, property, receiver) {
    // 其他代码省略
    return Reflect.get(target, property, receiver)
  },
})
console.log(proxyArr.length) // 3
