import * as bitcoinjs from 'bitcoinjs-lib'
import * as ecc from 'tiny-secp256k1';
import { BIP32Factory } from 'bip32';
bitcoinjs.initEccLib(ecc);
import { readFile } from 'fs'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const typef = require('typeforce');
const isHex64 = typef.HexN(64)
const bip32 = BIP32Factory(ecc);

let DBLIMIT = 440 // max sequential leveldb walk
let NETWORK = bitcoinjs.networks.regtest

let sleep = ms => new Promise(r => setTimeout(r, ms))

// export const rpc = (method, params, callback) => {
//   const rpcUrl = 'http://127.0.0.1:18443'
//   try {
//     const myHeaders = new Headers();
//     myHeaders.append("Content-Type", "application/json");
//     myHeaders.append('Authorization', 'Basic ' + btoa('test:testpwd'));
//     const requestOptions = {
//       method: 'POST',
//       headers: myHeaders,
//       body: JSON.stringify({ method, params })
//     };
//     // console.log(requestOptions)
//     // console.log('wallet', rpcUrl)
//     fetch(rpcUrl, requestOptions).then(async (res) => {
//       if (res.status === 401) return callback(new Error('Unauthorized'))
//       let { error, result } = await res.json()
//       if (error) return callback(new Error(error.message || error.code))
//       if (result === undefined) return callback(new TypeError('Missing RPC result'))
//       // console.log(method, result)
//       callback(null, result)
//     })
//   } catch (e) {
//     console.log('error', e)
//     throw e
//   }
// }


// let pRpc = (cmd, args) => new Promise((resolve, reject) => {
//   rpc(cmd, args, (err, data) => {
//     if (err) return reject(err)
//     else return resolve(data)
//   })
// })

let pUtxosByScriptRange = (indexd, scId) => new Promise((resolve, reject) => {
  indexd.utxosByScriptRange({
    scId, heightRange: [0, 0xffffffff], mempool: true
  }, DBLIMIT, (err, data) => {
    if (err) return reject(err)
    else return resolve(data)
  })
})

function rpcJSON2CB(tx) {
  return {
    txId: tx.txid,
    txHex: tx.hex,
    vsize: tx.vsize,
    version: tx.version,
    locktime: tx.locktime,
    ins: tx.vin.map((x) => {
      return {
        txId: x.txid,
        vout: x.vout,
        script: x.scriptSig.hex,
        sequence: x.sequence
      }
    }),
    outs: tx.vout.map((x) => {
      return {
        address: x.scriptPubKey.addresses ? x.scriptPubKey.addresses[0] : x.scriptPubKey.address ? x.scriptPubKey.address : undefined,
        script: x.scriptPubKey.hex,
        value: Math.round(x.value * 1e8) // satoshis
      }
    })
  }
}

export default function (router, indexd, callback = console.log) {

  const rpc = async (method, params, callback, walletname = '') => {
    try {
      // (cmd, args)
      const cmdMethod = { method, params }
      let { error, result } = await indexd.walletRpc({ cmdMethod, walletname })
      if (error) return callback(new Error(error.message || error.code))
      if (result === undefined) return callback(new TypeError('Missing RPC result'))
      callback(null, result)
    } catch {
      console.log('error', e)
      //  throw e
      callback(e)
    }
  }


  router.get('/t/mempool', (req, res) => {
    rpc('getrawmempool', [false], (err, data) => {
      res.send(data)
    })
  })

  router.post('/rpc', (req, res) => {
    // const cmd, args
    console.log(req.body)
    const cmd = req.body.method
    const args = req.body.params
    // return pRpc(cmd, args)
    rpc(cmd, args, (err, data) => {
      res.send(data)
    })
  })

  // const rpc = indexd.rpc
  // http://127.0.0.1:3000/a/bcrt1p7sp64fwr5kh7nmp5g0w2dpnkp7rqhzfqjsg549za5ku8knslxmsqeudygv/unspents
  const addressWare = {
    preHandler: (req, res, next) => {
      console.log('---addressWare---')
      console.log(typeof req, typeof res, typeof next)
      const { address } = req.params
      if (address) {
        try {
          const isScript = !address.match(/^[0-9a-f]+$/i)
          let script = isScript ? bitcoinjs.address.toOutputScript(address, NETWORK) : Buffer.from(address, 'hex')
          console.log('scId', bitcoinjs.crypto.sha256(script).toString('hex'))
          req.params.scId = bitcoinjs.crypto.sha256(script).toString('hex')
        } catch (e) {
          return res.status(400)
        }
      }

      next()
    }
  }

  router.get('/a/:address/firstseen', addressWare, (req, res) => {
    let { scId } = req.params
    indexd.firstSeenScriptId(scId, (err, data) => {
      res.send(data)
    })
  })

  router.get('/a/:address/txs', addressWare, (req, res) => {
    let { scId } = req.params
    let height = parseInt(req.query.height)
    if (!Number.isFinite(height)) height = 0

    indexd.transactionIdsByScriptRange({
      scId, heightRange: [0, 0xffffffff], mempool: true
    }, DBLIMIT, (err, txIds) => {
      if (err) return res.send(err)

      console.log("txIds", txIds)

      res.send(txIds)

      // parallel(txIds.map((txId) => {
      //   return (next) => rpc('getrawtransaction', [txId], next)
      // }), res.send)
    })
  })

  router.get('/a/:address/txids', addressWare, (req, res) => {
    let { scId } = req.params
    let height = parseInt(req.query.height)
    if (!Number.isFinite(height)) height = 0

    indexd.transactionIdsByScriptRange({
      scId, heightRange: [0, 0xffffffff], mempool: true
    }, DBLIMIT, (err, data) => {
      res.send(data)
    })
  })

  router.get('/a/:address/txos', addressWare, (req, res) => {
    let { scId } = req.params
    indexd.txosByScriptRange({
      scId, heightRange: [0, 0xffffffff], mempool: true
    }, DBLIMIT, (err, data) => {
      console.log(data)
      res.send(data)
    })
  })

  router.get('/a/:address/unspents', addressWare, (req, res) => {
    let { scId } = req.params
    indexd.utxosByScriptRange({
      scId, heightRange: [0, 0xffffffff], mempool: true
    }, DBLIMIT, (err, data) => {
      res.send(data)
    })
  })

  router.get('/a/alt/:address/unspents', addressWare, async (req, res) => {
    // This is added to mimic a certain API for educational use.
    try {
      let { scId } = req.params
      const unspents = await pUtxosByScriptRange(indexd, scId)
      const results = unspents.map(unspent => {
        const script = !!unspent.address
          ? bitcoinjs.address.toOutputScript(unspent.address, NETWORK)
          : null
        return {
          value_int: unspent.value,
          txid: unspent.txId,
          n: unspent.vout,
          ...(!unspent.address ? {} : { addresses: [unspent.address] }),
          ...(!unspent.address ? {} : {
            script_pub_key: {
              asm: bitcoinjs.script.toASM(script),
              hex: script.toString('hex')
            }
          }),
        }
      })
      res.send(results)
    } catch (err) {
      res.send(err)
    }
  })

  router.post('/t/push', (req, res) => {
    rpc('sendrawtransaction', [req.body], (err, data) => {
      res.send(data)
    })
  })

  router.post('/t/alt/pushtx', (req, res) => {
    // This mimics other api
    rpc('sendrawtransaction', [req.body.hex], (err, data) => {
      // if (err && /./.test(err.message)) return res.send(err, err.message)
      res.send(data)
    })
  })


  // http://127.0.0.1:3000/t/024a1e368212561b772a68276c18725a445fd11167fb48e5f3369a669064bbd0/json
  const hexWare = {
    preHandler: (req, res, next) => {
      console.log('---hexWare---')
      const { id } = req.params
      if (id) {
        if (!isHex64(id)) return res.status(400)
      }
      next()
    }
  }

  router.get('/t/:id', hexWare, (req, res) => {
    rpc('getrawtransaction', [req.params.id, false], (err, data) => {
      if (err) return res.send(err)
      res.send(data)
    })
  })

  router.get('/t/:id/json', hexWare, (req, res) => {
    rpc('getrawtransaction', [req.params.id, true], (err, json) => {
      if (err) return res.send(err)
      res.send(rpcJSON2CB(json))
    })
  })

  router.get('/t/:id/block', hexWare, (req, res) => {
    indexd.blockIdByTransactionId(req.params.id, res.easy)
  })

  router.get('/b/best', (req, res) => {
    rpc('getbestblockhash', [], (err, data) => {
      if (err) return res.send(err)
      res.send(data)
    })
  })

  router.get('/b/fees', (req, res) => {
    let count = parseInt(req.query.count)
    if (!Number.isFinite(count)) count = 12
    count = Math.min(count, 64)

    indexd.latestFeesForNBlocks(count, (err, results) => {
      if (results) {
        results.forEach((x) => {
          x.kB = Math.floor(x.size / 1024)
        })
      }
      res.send(results)
    })
  })

  const bestInjector = {
    preHandler: (req, res, next) => {
      console.log('---bestInjector---')
      const { id } = req.params
      if (id === 'best') {
        rpc('getbestblockhash', [], (err, id) => {
          if (err) return next(err)
          req.params.id = id
          next()
        })
      } else {
        next()
      }
    }
  }


  router.get('/b/:id/header', bestInjector, (req, res) => {
    rpc('getblockheader', [req.params.id, false], (err, json) => {
      if (err && /not found/.test(err.message)) return res.send(err.message)
      console.log('---- getblockheader header -----')
      res.send(json)
    })
  })

  //http://127.0.0.1:3000/b/best/height
  router.get('/b/:id/height', bestInjector, (req, res) => {
    rpc('getblockheader', [req.params.id, true], (err, json) => {
      if (err && /not found/.test(err.message)) return res.send(err.message)
      console.log('---- getblockheader height -----')
      res.send(json.height)
    })
  })

  // let AUTH_KEYS = {} 

  // // regtest features
  // function authMiddleware(req, res, next) {
  //   if (!req.query.key) return res.easy(401)
  //   let hash = bitcoinjs.crypto.sha256(req.query.key).toString('hex')
  //   if (hash in AUTH_KEYS) return next()
  //   res.easy(401)
  // }

  const authMiddleware = {
    preHandler: (req, res, next) => {
      console.log('---authMiddleware---')
      const { key } = req.query
      if (key) {
        let hash = bitcoinjs.crypto.sha256(key).toString('hex')
        // if (hash in AUTH_KEYS) return next()
        if (hash) return next()
      } else {
        res.status(401)
      }
    }
  }

  // count //default
  //http://127.0.0.1:3000/r/generate?key=ss&&count=2
  router.get('/r/generate', authMiddleware, (req, res) => {
    rpc('getnewaddress', [], (err, address) => {
      if (err) return res.send(err)
      rpc('generatetoaddress', [parseInt(req.query.count) || 1, address], (err, data) => {
        if (err) return res.send(err)
        res.send(data)
      })
    }, 'default')
  })

  router.post('/r/faucet', authMiddleware, (req, res) => {
    rpc('sendtoaddress', [req.query.address, parseInt(req.query.value) / 1e8, '', '', false, false, null, 'unset', false, 1], (err, data) => {
      if (err) return res.send(err)
      res.send(data)
    }, 'default')
  })

  //http://127.0.0.1:3000/r/faucetScript?key=ss&&script=2&value=10000
  router.get('/r/faucetScript', authMiddleware, async (req, res) => {
    try {
      const secret = '7a4885c2d9d29b08f090e1e12703db21b9626d50ae42d43e8328acf67bb19976'
      const keyPair = bip32.fromPrivateKey(Buffer.from(secret, 'hex'), Buffer.alloc(32, 0), NETWORK);
      // const keyPair = bip32.makeRandom({ network: NETWORK })
      const payment = bitcoinjs.payments.p2pkh({ pubkey: keyPair.publicKey, network: NETWORK })
      const address = payment.address
      const scId = bitcoinjs.crypto.sha256(payment.output).toString('hex')
      console.log("scId",scId,address)
      rpc('sendtoaddress', [address, parseInt(req.query.value) * 2 / 1e8, '', '', false, false, null, 'unset', false, 1], async (err, txId) => {
        if (err) return res.send(err)
        // res.send(data)
        let unspent
        let counter = 10
        while (!unspent) {
          const unspents = await pUtxosByScriptRange(indexd, scId)
          unspent = unspents.filter(x => x.txId === txId)[0]
          if (!unspent) {
            counter--
            if (counter <= 0) throw new Error('No outputs')
            await sleep(10)
          }
        }
        const txvb = new bitcoinjs.Transaction(NETWORK);
        txvb.addInput(unspent.txId, unspent.vout, undefined, payment.output);
        txvb.addOutput(Buffer.from(req.query.script, 'hex'), parseInt(req.query.value));
        txvb.sign(0, keyPair);
        const txv = txvb.build();
        await rpc('sendrawtransaction', [txv.toHex()])
        res.send(txv.getId())

      }, 'default')
    } catch (err) {
      res.send(err)
    }
  })

  // const psbt = new bitcoinjs.Psbt({ network: NETWORK })
  // .addInput({
  //     hash: unspent.txId,
  //     index: unspent.vout,
  //     nonWitnessUtxo: Buffer.from(utx.txHex, 'hex'),
  // })
  // .addOutput({
  //     address: Buffer.from(req.query.script, 'hex'),
  //     value: parseInt(req.query.value),
  // });
  // psbt.signInput(0, keyPair); 

  // const txv = psbt.finalizeAllInputs().extractTransaction().toHex()
  // console.log(hexx)



  // readFile(process.env.KEYDB, (err, buffer) => {
  //   if (err) return callback(err)

  //   buffer
  //     .toString('utf8')
  //     .split('\n')
  //     .filter(x => x)
  //     .map(x => bitcoinjs.crypto.sha256(x).toString('hex')) // XXX: yes, from plain-text :)
  //     .forEach(x => (AUTH_KEYS[x] = true))
  //   debug(`imported ${Object.keys(AUTH_KEYS).length} authorized keys`.toUpperCase())

  //   callback()
  // })
}
