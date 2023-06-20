// let debug = require('debug')('indexd')
// let debug = require('debug')('indexd')
import { dbwrapper } from './dbwrapper.js'
import { EventEmitter } from 'events'
import parallel from 'run-parallel'
import { block as _block, tip as _tip, blockIdAtHeight, headerJSON, mempool, transaction } from './rpc.js'

import FeeIndex from './indexes/fee.js'
import MtpIndex from './indexes/mediantime.js'
import ScriptIndex from './indexes/script.js'
import TxIndex from './indexes/tx.js'
import TxinIndex from './indexes/txin.js'
import TxoIndex from './indexes/txo.js'

export const Rpc = (rpcUrl) => {
  return (method, params, callback) => {
    try {
      const myHeaders = new Headers();
      myHeaders.append("Content-Type", "application/json");
      myHeaders.append('Authorization', 'Basic ' + btoa('test:testpwd'));
      const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: JSON.stringify({ method, params })
      };
      // console.log(requestOptions)
      // console.log('wallet', rpcUrl)
      fetch(rpcUrl, requestOptions).then(async (res) => {
        if (res.status === 401) return callback(new Error('Unauthorized'))
        let { error, result } = await res.json()
        if (error) return callback(new Error(error.message || error.code))
        if (result === undefined) return callback(new TypeError('Missing RPC result'))
        // console.log(method, result)
        callback(null, result)
      })
    } catch (e) {
      console.log('error', e)
      throw e
    }
  }
}


function txoToString({ txId, vout }) {
  return `${txId}:${vout}`
}

function isConstructor(obj) {
  try {
    new obj();
    return true;
  } catch (err) {
    return false;
  }
}

export class Indexd {
  constructor(db, rpcUrl) {
    this.db = dbwrapper(db)
    this.rpcUrl =rpcUrl
    this.rpc = Rpc(rpcUrl)
    this.emitter = new EventEmitter() // TODO: bind to this
    this.emitter.setMaxListeners(Infinity)
    this.indexes = {
      fee: new FeeIndex(),
      mtp: new MtpIndex(),
      script: new ScriptIndex(),
      tx: new TxIndex(),
      txin: new TxinIndex(),
      txo: new TxoIndex()
    }
    console.log('new Indexd')
  }

  //
  async walletRpc({ cmdMethod = {}, walletname = '' }) {
    try {
      const myHeaders = new Headers();
      myHeaders.append("Content-Type", "application/json");
      myHeaders.append('Authorization', 'Basic ' + btoa('test:testpwd'));

      const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: JSON.stringify(cmdMethod)
      };
      const url = walletname ? `${this.rpcUrl}/wallet/${walletname}` : this.rpcUrl
      // console.log(requestOptions)
      console.log('wallet', url)
      const req = await fetch(url, requestOptions);
      return req.json();
    } catch (e) {
      console.log('error', e)
      throw e
    }
  }

  // get indexd tip
  tips(callback) {
    let tasks = {}

    for (let indexName in this.indexes) {
      let index = this.indexes[indexName]
      tasks[indexName] = (next) => index.tip(this.db, next)
    }

    parallel(tasks, callback)
  }
  // recurses until `nextBlockId` is falsy
  connectFrom(prevBlockId, blockId, callback) {
    this.tips((err, tips) => {
      if (err) return callback(err)

      let todo = {}
      for (let indexName in tips) {
        let tip = tips[indexName]
        if (tip && tip.blockId !== prevBlockId) continue
        if (indexName === 'fee') {
          if (!tips.txo) continue
          if (tip && tips.fee.height > tips.txo.height) continue
        }

        todo[indexName] = true
      }

      let todoList = Object.keys(todo)
      if (todoList.length === 0) return callback(new RangeError('Misconfiguration'))

      console.debug(`Downloading ${blockId} (for ${todoList})`)

      _block(this.rpc, blockId, (err, block) => {
        if (err) return callback(err)

        let atomic = this.db.atomic()
        let events // TODO
        let { height } = block
        console.debug(`Connecting ${blockId} @ ${height}`)

        // connect block to relevant chain tips
        for (let indexName in todo) {
          let index = this.indexes[indexName]
          if (!index.connect) continue

          index.connect(atomic, block, events)
        }

        atomic.write((err) => {
          if (err) return callback(err)
          console.debug(`Connected ${blockId} @ ${height}`)

          let self = this
          function loop(err) {
            if (err) return callback(err)

            // recurse until nextBlockId is falsy
            if (!block.nextBlockId) return callback(null, true)
            self.connectFrom(blockId, block.nextBlockId, callback)
          }

          if (!todo.fee) return loop()

          console.debug(`Connecting ${blockId} (2nd Order)`)
          let atomic2 = this.db.atomic()
          this.indexes.fee.connect2ndOrder(this.db, this.indexes.txo, atomic2, block, (err) => {
            if (err) return loop(err)

            console.debug(`Connected ${blockId} (2nd Order)`)
            atomic2.write(loop)
          })
        })
      })
    })
  }
  disconnect(blockId, callback) {
    debug(`Disconnecting ${blockId}`)

    function fin(err) {
      if (err) return callback(err)
      debug(`Disconnected ${blockId}`)
      callback()
    }

    this.tips((err, tips) => {
      if (err) return fin(err)

      // TODO: fetch lazily
      _block(this.rpc, blockId, (err, block) => {
        if (err) return fin(err)

        let atomic = this.db.atomic()

        // disconnect block from relevant chain tips
        for (let indexName in this.indexes) {
          let index = this.indexes[indexName]
          let tip = tips[indexName]
          if (!tip) continue
          if (tip.blockId !== block.blockId) continue

          index.disconnect(atomic, block)
        }

        atomic.write(fin)
      })
    })
  }
  // empties the mempool
  clear() {
    // for (let indexName in this.indexes) {
    //   this.indexes[indexName].constructor()
    // }
    for (let indexName of Object.keys(this.indexes)) {
      if (isConstructor(this.indexes[indexName])) {
        new this.indexes[indexName]()
      } else {
        // console.log('clear',indexName)
      }
    }
  }
  lowestTip(callback) {
    this.tips((err, tips) => {
      if (err) return callback(err)

      let lowest
      for (let key in tips) {
        let tip = tips[key]
        if (!tip) return callback()
        if (!lowest) lowest = tip
        if (lowest.height < tip.height) continue
        lowest = tip
      }

      callback(null, lowest)
    })
  }
  __resync(done) {
    // console.log('resynchronizing')
    parallel({
      bitcoind: (f) => _tip(this.rpc, f),
      indexd: (f) => this.lowestTip(f)
    }, (err, r) => {
      if (err) return done(err)
      console.debug('resynchronizing', r)
      const { indexd, bitcoind } = r
      // Step 0, genesis?
      if (!indexd) {
        console.debug('genesis')
        return blockIdAtHeight(this.rpc, 0, (err, genesisId) => {
          if (err) return done(err)

          this.connectFrom(null, genesisId, done)
        })
      }

      // Step 1, equal?
      if (bitcoind.blockId === indexd.blockId) return done()

      // Step 2, is indexd behind? [aka, does bitcoind have the indexd tip]
      headerJSON(this.rpc, indexd.blockId, (err, common) => {
        //  if (err && /not found/.test(err.message)) return fin(err) // uh, burn it to the ground
        if (err) return done(err)

        // forked?
        if (common.confirmations === -1) {
          console.debug('forked')
          return this.disconnect(indexd.blockId, (err) => {
            if (err) return done(err)

            this.__resync(done)
          })
        }

        // yes, indexd is behind
        console.debug('bitcoind is ahead')
        this.connectFrom(common.blockId, common.nextBlockId, done)
      })
    })
  }
  tryResync(callback) {
    // console.log('tryResync', this.syncing)
    if (callback) {
      this.emitter.once('resync', callback)
    }

    if (this.syncing) return
    this.syncing = true

    let self = this
    function fin(err) {
      self.syncing = false
      self.emitter.emit('resync', err)
    }

    this.__resync((err, updated) => {
      if (err) return fin(err)
      if (updated) return this.tryResyncMempool(fin)
      fin()
    })
  }
  tryResyncMempool(callback) {
    mempool(this.rpc, (err, txIds) => {
      if (err) return callback(err)

      this.clear()
      parallel(txIds.map((txId) => (next) => this.notify(txId, next)), callback)
    })
  }
  notify(txId, callback) {
    transaction(this.rpc, txId, (err, tx) => {
      if (err) return callback(err)

      for (let indexName in this.indexes) {
        let index = this.indexes[indexName]

        if (!index.mempool) continue
        index.mempool(tx)
      }

      callback()
    })
  }
  // QUERIES
  blockIdByTransactionId(txId, callback) {
    this.indexes.tx.heightBy(this.db, txId, (err, height) => {
      if (err) return callback(err)
      if (height === -1) return callback()

      blockIdAtHeight(this.rpc, height, callback)
    })
  }
  // 
  latestFeesForNBlocks(nBlocks, callback) {
    this.indexes.fee.latestFeesFor(this.db, nBlocks, callback)
  }
  // returns a txo { txId, vout, value, script }, by key { txId, vout }
  txoByTxo(txo, callback) {
    this.indexes.txo.txoBy(this.db, txo, callback)
  }
  // returns the height at scId was first-seen (-1 if unconfirmed)
  firstSeenScriptId(scId, callback) {
    this.indexes.script.firstSeenScriptId(this.db, scId, callback)
  }
  // returns a list of txIds with inputs/outputs from/to a { scId, heightRange, ?mempool }
  transactionIdsByScriptRange(scRange, dbLimit, callback) {
    this.txosByScriptRange(scRange, dbLimit, (err, txos) => {
      if (err) return callback(err)

      let txIdSet = {}
      let tasks = txos.map((txo) => {
        txIdSet[txo.txId] = true
        return (next) => this.indexes.txin.txinBy(this.db, txo, next)
      })

      parallel(tasks, (err, txins) => {
        if (err) return callback(err)

        txins.forEach((txin) => {
          if (!txin) return
          txIdSet[txin.txId] = true
        })

        callback(null, Object.keys(txIdSet))
      })
    })
  }
  // returns a list of txos { txId, vout, height, value } by { scId, heightRange, ?mempool }
  txosByScriptRange(scRange, dbLimit, callback) {
    this.indexes.script.txosBy(this.db, scRange, dbLimit, callback)
  }
  // returns a list of (unspent) txos { txId, vout, height, value }, by { scId, heightRange, ?mempool }
  // XXX: despite txo queries being bound by heightRange, the UTXO status is up-to-date
  utxosByScriptRange(scRange, dbLimit, callback) {
    this.txosByScriptRange(scRange, dbLimit, (err, txos) => {
      if (err) return callback(err)

      let taskMap = {}
      let unspentMap = {}

      txos.forEach((txo) => {
        let txoId = txoToString(txo)
        unspentMap[txoId] = txo
        taskMap[txoId] = (next) => this.indexes.txin.txinBy(this.db, txo, next)
      })

      parallel(taskMap, (err, txinMap) => {
        if (err) return callback(err)

        let unspents = []
        for (let txoId in txinMap) {
          let txin = txinMap[txoId]

          // has a txin, therefore spent
          if (txin) continue

          unspents.push(unspentMap[txoId])
        }

        callback(null, unspents)
      })
    })
  }
}

















// export default Indexd
