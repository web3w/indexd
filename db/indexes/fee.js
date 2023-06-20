import parallel from 'run-parallel'
// import { compile, UInt32, UInt53 } from 'typeforce'
import { tip as _tip, typeforce as typef } from './types.js'
import vstruct, { Value, UInt8, UInt32BE, UInt64LE, UInt32LE } from 'varstruct'

let FEEPREFIX = 0x81
let FEETIP = _tip(FEEPREFIX)
let FEE = {
  keyType: typef.compile({
    height: typef.UInt32
  }),
  key: vstruct([
    ['prefix', Value(UInt8, FEEPREFIX)],
    ['height', UInt32BE] // big-endian for lexicographical sort
  ]),
  valueType: typef.compile({
    iqr: {
      q1: typef.UInt53,
      median: typef.UInt53,
      q3: typef.UInt53
    },
    size: typef.UInt32
  }),
  value: vstruct([
    ['iqr', vstruct([
      ['q1', UInt64LE],
      ['median', UInt64LE],
      ['q3', UInt64LE]
    ])],
    ['size', UInt32LE]
  ])
}

class FeeIndex {
  constructor() { }
  tip(db, callback) {
    db.get(FEETIP, {}, callback)
  }
  connect2ndOrder(db, txoIndex, atomic, block, callback) {
    let { height, transactions } = block

    let txTasks = []
    transactions.forEach((tx) => {
      let { ins, outs, vsize } = tx
      let inAccum = 0
      let outAccum = 0
      let txoTasks = []
      let coinbase = false

      ins.forEach((input, vin) => {
        if (coinbase) return
        if (input.coinbase) {
          coinbase = true
          return
        }

        let { prevTxId, vout } = input
        txoTasks.push((next) => {
          txoIndex.txoBy(db, { txId: prevTxId, vout }, (err, txo) => {
            if (err) return next(err)
            if (!txo) return next(new Error(`Missing ${prevTxId}:${vout}`))

            inAccum += txo.value
            next()
          })
        })
      })

      outs.forEach(({ value }, vout) => {
        if (coinbase) return
        outAccum += value
      })

      txTasks.push((next) => {
        if (coinbase) return next(null, 0)

        parallel(txoTasks, (err) => {
          if (err) return next(err)
          let fee = inAccum - outAccum
          let feeRate = Math.floor(fee / vsize)

          next(null, feeRate)
        })
      })
    })

    parallel(txTasks, (err, feeRates) => {
      if (err) return callback(err)
      feeRates = feeRates.sort((a, b) => a - b)

      atomic.put(FEE, { height }, {
        iqr: box(feeRates),
        size: block.strippedsize
      })
      atomic.put(FEETIP, {}, block)

      callback()
    })
  }
  disconnect(atomic, block) {
    let { height } = block

    atomic.del(FEE, { height })
    atomic.put(FEETIP, {}, { blockId: block.prevBlockId, height })
  }
  latestFeesFor(db, nBlocks, callback) {
    db.get(FEETIP, {}, (err, tip) => {
      if (err) return callback(err)
      if (!tip) return callback(null, [])

      let { height: maxHeight } = tip
      let results = []

      console.log('maxHeight', maxHeight, maxHeight - (nBlocks - 1))
      db.iterator(FEE, {
        gte: {
          height: maxHeight - (nBlocks - 1)
        },
        lte:{
          height: 0xffffffff
        },
        limit: nBlocks
      }, ({ height }, { fees, size }) => {
        console.log('latestFeesFor-height',height,size)
        results.push({ height, fees, size })
      }, (err) => callback(err, results))
    })
  }
}


function box(data) {
  if (data.length === 0) return { q1: 0, median: 0, q3: 0 }
  let quarter = (data.length / 4) | 0
  let midpoint = (data.length / 2) | 0

  return {
    q1: data[quarter],
    median: data[midpoint],
    q3: data[midpoint + quarter]
  }
}




export default FeeIndex
const _types = {
  data: FEE,
  tip: FEETIP
}
export { _types as types }
