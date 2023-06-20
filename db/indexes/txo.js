import { tip as _tip,typeforce as typef  } from './types.js'
// import { compile, HexN, UInt32, UInt53, Buffer, UInt8 } from 'typeforce'
import varuint from 'varuint-bitcoin'
import vstruct, { Value, UInt8 as _UInt8, String, UInt32LE, UInt64LE, VarBuffer, Byte } from 'varstruct'

let TXOPREFIX = 0x34
let TXOTIP = _tip(TXOPREFIX)
let TXO = {
  keyType: typef.compile({
    txId: typef.HexN(64),
    vout: typef.UInt32
  }),
  key: vstruct([
    ['prefix', Value(_UInt8, TXOPREFIX)],
    ['txId', String(32, 'hex')],
    ['vout', UInt32LE]
  ]),
  valueType: typef.compile({
    value: typef.UInt53,
    script: Buffer,
    coinbase: typef.UInt8
  }),
  value: vstruct([
    ['value', UInt64LE],
    ['script', VarBuffer(varuint)],
    ['coinbase', Byte]
  ])
}

class TxoIndex {
  constructor() {
    this.txos = {}
  }
  tip(db, callback) {
    db.get(TXOTIP, {}, callback)
  }
  mempool(tx) {
    let { txId, outs } = tx

    outs.forEach(({ script, value, vout }) => {
      this.txos[`${txId}:${vout}`] = { script, value }
    })
  }
  connect(atomic, block) {
    let { transactions } = block

    transactions.forEach((tx) => {
      let { txId, outs } = tx

      let coinbase = (tx.ins.reduce((cb, txin) => cb || ('coinbase' in txin), false)) ? 1 : 0

      outs.forEach(({ script, value, vout }) => {
        atomic.put(TXO, { txId, vout }, { value, script, coinbase })
      })
    })

    atomic.put(TXOTIP, {}, block)
  }
  disconnect(atomic, block) {
    let { height, transactions } = block

    transactions.forEach((tx) => {
      let { txId, outs } = tx

      outs.forEach(({ value, vout }) => {
        atomic.del(TXO, { txId, vout })
      })
    })

    atomic.put(TXOTIP, {}, { blockId: block.prevBlockId, height })
  }
  // returns a txo { txId, vout, value, script } by { txId, vout }
  txoBy(db, txo, callback) {
    let { txId, vout } = txo
    let mem = this.txos[`${txId}:${vout}`]
    if (mem) return callback(null, mem)

    db.get(TXO, txo, callback)
  }
}






export default TxoIndex
const _types = {
  data: TXO,
  tip: TXOTIP
}
export { _types as types }
