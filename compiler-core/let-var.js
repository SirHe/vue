const source1 = `
let i = 1
let m = 1
for(let i = 0; i < 3; i++) {
    i += 1
}
{
    let m = 2
    m = 6
}
console.log(i, m)
`
eval(source1) // 1、1
const source2 = source1.replace(/let/g, 'var')
eval(source2) // 4、6