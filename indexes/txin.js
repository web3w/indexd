import { tip as _tip,typeforce as typef  } from './types.js'
// import { compile, HexN, UInt32, UInt8 } from 'typeforce'
import vstruct, { Value, UInt8 as _UInt8, String, UInt32LE, Byte } from 'varstruct'
import { getOrSetDefault } from './utils.js'

let TXINPREFIX = 0x32
let TXINTIP = _tip(TXINPREFIX)
let TXIN = {
  keyType: typef.compile({
    txId: typef.HexN(64),
    vout: typef.UInt32
  }),
  key: vstruct([
    ['prefix', Value(_UInt8, TXINPREFIX)],
    ['txId', String(32, 'hex')],
    ['vout', UInt32LE]
  ]),
  valueType: typef.compile({
    txId: typef.HexN(64),
    vin: typef.UInt32,
    coinbase: typef.UInt8
  }),
  value: vstruct([
    ['txId', String(32, 'hex')],
    ['vin', UInt32LE],
    ['coinbase', Byte]
  ])
}

class TxinIndex {
  constructor() {
    this.txins = {}
  }
  tip(db, callback) {
    db.get(TXINTIP, {}, callback)
  }
  mempool(tx, events) {
    let { txId, ins } = tx

    ins.forEach((input, vin) => {
      if (input.coinbase) return
      let { prevTxId, vout } = input

      getOrSetDefault(this.txins, `${prevTxId}:${vout}`, [])
        .push({ txId, vin })

      if (events) events.push(['txin', `${prevTxId}:${vout}`, txId, vin])
    })
  }
  connect(atomic, block, events) {
    let { transactions } = block

    transactions.forEach((tx) => {
      let { txId, ins } = tx

      ins.forEach((input, vin) => {
        let coinbase = ('coinbase' in input) ? 1 : 0

        let { prevTxId, vout } = input

        if (!prevTxId) {
          prevTxId = '0000000000000000000000000000000000000000000000000000000000000000'
          vout = 0xffffffff
        }

        atomic.put(TXIN, { txId: prevTxId, vout }, { txId, vin, coinbase })

        if (events) events.push(['txin', `${prevTxId}:${vout}`, txId, vin])
      })
    })

    atomic.put(TXINTIP, {}, block)
  }
  disconnect(atomic, block) {
    let { height, transactions } = block

    transactions.forEach((tx) => {
      let { txId, outs } = tx

      outs.forEach(({ value, vout }) => {
        atomic.del(TXIN, { txId, vout })
      })
    })

    atomic.put(TXINTIP, {}, { blockId: block.prevBlockId, height })
  }
  // returns a txin { txId, vin } by { txId, vout }
  txinBy(db, txo, callback) {
    let { txId, vout } = txo
    let mem = this.txins[`${txId}:${vout}`]
    if (mem) return callback(null, mem[0]) // XXX: returns first-seen only

    db.get(TXIN, txo, callback)
  }
}






export default TxinIndex
const _types = {
  data: TXIN,
  tip: TXINTIP
}
export { _types as types }
