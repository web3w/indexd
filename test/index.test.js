import { BitcoinIndexd } from '../index.js'

const btcIndexd = new BitcoinIndexd('./_dist/', 'http://127.0.0.1:18443', 'tcp://127.0.0.1:30001')

const foo = btcIndexd.initialize((info) => {
    console.log('btcIndexd', info)
    btcIndexd.view()
})

// btcIndexd.indexd.rpc('getbestblockhash', [], (err, result) => {
//   console.log(err, result)
// })

