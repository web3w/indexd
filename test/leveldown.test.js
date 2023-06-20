var levelup = require('levelup')
var leveldown = require('leveldown')

// 1) Create our store
let db = levelup(leveldown('/Users/liyu/Github/indexd/_dist1'))

// 2) Put a key & value
// db.put('name', 'levelup', function (err) {
//     if (err) return console.log('Ooops!', err) // some kind of I/O error

//     // 3) Fetch by key
//     db.get('name', function (err, value) {
//         if (err) return console.log('Ooops!', err) // likely the key was not found

//         // Ta da!
//         console.log('name=' + value)
//     })
// })

db.createKeyStream()
  .on('data', function (data) {
    console.log('key=', data.toString('hex'))
  })

// db.createReadStream()
//   .on('data', function (data) {
//     console.log(data.key.toString('hex'), '=', data.value.toString('hex'))
//   })
//   .on('error', function (err) {
//     console.log('Oh my!', err)
//   })
//   .on('close', function () {
//     console.log('Stream closed')
//   })
//   .on('end', function () {
//     console.log('Stream ended')
//   })