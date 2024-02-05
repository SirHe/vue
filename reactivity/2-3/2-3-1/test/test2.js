// test2.js
const originalData = {
  a: 123,
  b: 456,
  get sum() {
    console.log(this === originalData, this === reactivityData)
    return this.a + this.b
  },
}
const reactivityData = new Proxy(originalData, {
  get(target, key) {
    console.log('get', key)
    return target[key]
  },
})

reactivityData.sum
// get sum
// true false
