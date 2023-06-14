const BitcoinIndexd = require('../index')

const indexd = new BitcoinIndexd('./_dist/', 'http://127.0.0.1:18443', 'tcp://127.0.0.1:31000')

indexd.rpc('getbestblockhash', [], (err, result) => {
    console.log(err, result)
})

