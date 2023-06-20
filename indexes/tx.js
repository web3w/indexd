import { tip as _tip,typeforce as typef  } from './types.js'
// import { compile, HexN, UInt32 } from 'typeforce'
import vstruct, { Value, UInt8, String, UInt32LE } from 'varstruct'

let TXPREFIX = 0x35
let TXTIP = _tip(TXPREFIX)
let TX = {
  keyType: typef.compile({
    txId: typef.HexN(64)
  }),
  key: vstruct([
    ['prefix', Value(UInt8, TXPREFIX)],
    ['txId', String(32, 'hex')]
  ]),
  valueType: typef.compile({
    height: typef.UInt32
  }),
  value: vstruct([
    ['height', UInt32LE]
  ])
}

class TxIndex {
  constructor() {
    this.txs = {}
  }
  tip(db, callback) {
    db.get(TXTIP, {}, callback)
  }
  mempool(tx, events) {
    let { txId } = tx

    this.txs[txId] = true
  }
  connect(atomic, block, events) {
    let { height, transactions } = block

    transactions.forEach((tx) => {
      let { txId } = tx
      atomic.put(TX, { txId }, { height })
    })

    atomic.put(TXTIP, {}, block)
  }
  disconnect(atomic, block) {
    let { height, transactions } = block

    transactions.forEach((tx) => {
      let { txId } = tx

      atomic.del(TX, { txId })
    })

    atomic.put(TXTIP, {}, { blockId: block.prevBlockId, height })
  }
  // returns the height (-1 if unconfirmed, null if unknown) of a transaction, by txId
  heightBy(db, txId, callback) {
    let mem = this.txs[txId]
    if (mem) return callback(null, -1)

    db.get(TX, { txId }, (err, result) => {
      if (err) return callback(err)
      if (!result) return callback(null, null)

      callback(null, result.height)
    })
  }
}






export default TxIndex
const _types = {
  data: TX,
  tip: TXTIP
}
export { _types as types }
