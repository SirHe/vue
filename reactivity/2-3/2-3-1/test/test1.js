// test1.js
const originalData = {
  a: 123,
  b: 456,
  get sum() {
    console.log(this === originalData)
    return this.a + this.b
  },
}
originalData.sum
// true
