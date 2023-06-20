import { createHash } from 'crypto'
import { tip as _tip,typeforce as typef } from './types.js'
// import { compile, HexN, UInt32, UInt53, UInt8 } from 'typeforce'
import vstruct, { Value, UInt8 as _UInt8, String, UInt32BE, UInt32LE, UInt64LE, Byte } from 'varstruct'
import { getOrSetDefault } from './utils.js'

let SCRIPTPREFIX = 0x33
export const SCRIPTTIP = _tip(SCRIPTPREFIX)
let SCRIPT = {
  keyType: typef.compile({
    scId: typef.HexN(64),
    height: typef.UInt32,
    txId: typef.HexN(64),
    vout: typef.UInt32
  }),
  key: vstruct([
    ['prefix', Value(_UInt8, SCRIPTPREFIX)],
    ['scId', String(32, 'hex')],
    ['height', UInt32BE], // big-endian for lexicographical sort
    ['txId', String(32, 'hex')],
    ['vout', UInt32LE]
  ]),
  valueType: typef.compile({
    value: typef.UInt53,
    coinbase: typef.UInt8
  }),
  value: vstruct([
    ['value', UInt64LE],
    ['coinbase', Byte]
  ])
}

function sha256 (buffer) {
  return createHash('sha256')
    .update(buffer)
    .digest('hex')
}

export default class ScriptIndex { 
  constructor() {
    this.scripts = {}
  }
  tip(db, callback) {
    db.get(SCRIPTTIP, {}, callback)
  }
  mempool(tx, events) {
    let { txId, outs } = tx

    outs.forEach(({ vout, script, value }) => {
      let scId = sha256(script)
      getOrSetDefault(this.scripts, scId, [])
        .push({ txId, vout, height: -1, value })

      if (events) events.push(['script', scId, null, txId, vout, value])
    })
  }
  connect(atomic, block, events) {
    let { height, transactions } = block

    transactions.forEach((tx) => {
      let { txId, outs } = tx

      let coinbase = (tx.ins.reduce((cb, txin) => cb || ('coinbase' in txin), false)) ? 1 : 0

      outs.forEach(({ vout, script, value }) => {
        let scId = sha256(script)
        atomic.put(SCRIPT, { scId, height, txId, vout }, { value, coinbase })

        if (events) events.push(['script', scId, height, txId, vout, value])
      })
    })

    atomic.put(SCRIPTTIP, {}, block)
  }
  disconnect(atomic, block) {
    let { height, transactions } = block

    transactions.forEach((tx) => {
      let { txId, outs } = tx

      outs.forEach(({ vout, script }) => {
        let scId = sha256(script)
        atomic.del(SCRIPT, { scId, height, txId, vout })
      })
    })

    atomic.put(SCRIPTTIP, {}, { blockId: block.prevBlockId, height })
  }
  // returns the height at scId was first-seen (-1 if unconfirmed, null if unknown)
  firstSeenScriptId(db, scId, callback) {
    let result = null
    db.iterator(SCRIPT, {
      gte: { scId, height: 0, txId: ZERO64, vout: 0 },
      lt: { scId, height: 0xffffffff, txId: ZERO64, vout: 0 },
      limit: 1
    }, ({ height }) => {
      result = height
    }, (err) => {
      if (err) return callback(err)
      if (result !== null) return callback(null, result)

      let mem = this.scripts[scId]
      if (mem) return callback(null, -1)
      callback(null, null)
    })
  }
  // XXX: if heightRange distance is < 2, the limit is ignored
  //   -- could be rectified by supporting a minimum txId value (aka, last retrieved)
  //
  // returns a list of { txId, vout, height, value } by { scId, heightRange: [from, to] }
  txosBy(db, { scId, heightRange, mempool }, maxRows, callback) {
    let [fromHeight, toHeight] = heightRange
    let distance = toHeight - fromHeight
    if (distance < 0) return callback(null, [])
    if (distance < 2) maxRows = Infinity
    fromHeight = Math.min(Math.max(0, fromHeight), 0xffffffff)
    toHeight = Math.min(Math.max(0, toHeight), 0xffffffff)

    let results = []
    if (mempool && (scId in this.scripts)) {
      results = this.scripts[scId].concat()
    }

    db.iterator(SCRIPT, {
      gte: { scId, height: fromHeight, txId: ZERO64, vout: 0 },
      lt: { scId, height: toHeight, txId: MAX64, vout: 0xffffffff },
      limit: maxRows + 1
    }, ({ height, txId, vout }, { value, coinbase }, __iterator) => {
      results.push({
        txId, vout, height, value, coinbase
      })

      if (results.length > maxRows) return __iterator.end((err) => callback(err || new RangeError('Exceeded Limit')))
    }, (err) => callback(err, results))
  }
}

let ZERO64 = '0000000000000000000000000000000000000000000000000000000000000000'
let MAX64 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

const _types = {
  data: SCRIPT,
  tip: SCRIPTTIP
}
export { _types as types }
