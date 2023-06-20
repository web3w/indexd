// let debug = require('./debug')('indexd:rpc')

function rpcd(rpc, method, params, done) {
  // debug(method, params)
  rpc(method, params, (err, result) => {
    if (err) console.debug(method, params, err)
    if (err) return done(err)

    done(null, result)
  })
}

function augment(tx) {
  delete tx.hex
  tx.txId = tx.txid
  delete tx.txid
  tx.vin.forEach((input) => {
    input.prevTxId = input.txid
    delete input.txid
  })
  tx.vout.forEach((output) => {
    output.script = Buffer.from(output.scriptPubKey.hex, 'hex')
    delete output.scriptPubKey
    output.value = Math.round(output.value * 1e8)
    output.vout = output.n
    delete output.n
  })
  tx.ins = tx.vin
  tx.outs = tx.vout
  delete tx.vin
  delete tx.vout
  return tx
}

export function block(rpc, blockId, done) {
  rpcd(rpc, 'getblock', [blockId, 2], (err, block) => {
    if (err) return done(err)

    block.blockId = blockId
    delete block.hash
    block.nextBlockId = block.nextblockhash
    delete block.nextblockhash
    block.prevBlockId = block.previousblockhash
    delete block.prevblockhash
    block.medianTime = block.mediantime
    delete block.mediantime

    block.transactions = block.tx.map(t => augment(t))
    delete block.tx

    done(null, block)
  })
}

export function blockIdAtHeight(rpc, height, done) {
  rpcd(rpc, 'getblockhash', [height], done)
}

export function headerJSON(rpc, blockId, done) {
  rpcd(rpc, 'getblockheader', [blockId, true], (err, header) => {
    if (err) return done(err)

    header.blockId = blockId
    delete header.hash
    header.nextBlockId = header.nextblockhash
    delete header.nextblockhash

    done(null, header)
  })
}

export function mempool(rpc, done) {
  rpcd(rpc, 'getrawmempool', [false], done)
}

export function tip(rpc, done) {
  rpcd(rpc, 'getchaintips', [], (err, tips) => {
    if (err) return done(err)

    let {
      hash: blockId,
      height
    } = tips.filter(x => x.status === 'active').pop()

    done(null, { blockId, height })
  })
}

export function transaction(rpc, txId, next, forgiving) {
  rpcd(rpc, 'getrawtransaction', [txId, true], (err, tx) => {
    if (err) {
      if (forgiving && /No such mempool or blockchain transaction/.test(err)) return next()
      return next(err)
    }

    next(null, augment(tx))
  })
}
