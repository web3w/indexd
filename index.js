import leveldown from 'leveldown';
import levelup from 'levelup';
// const level = require('level-party');
import { socket } from 'zeromq';
import { Indexd } from './indexd.js';
// let debug = require('debug')('service')
let debugZmq = console.debug //require('debug')('service:zmq')
let debugZmqTx = console.debug // require('debug')('service:zmq:tx')

import { createViewerServer } from './viewerserver.js';

// keyEncoding: 'string', valueEncoding: 'json'
// const db = levelup(encode(leveldown('/Users/liyu/Github/indexd/_dist1'), { keyEncoding: 'buffer', valueEncoding: 'json' })); 
// const db = levelup(encode(leveldown('/Users/liyu/Github/indexd/_dist'),{ keyEncoding: 'string', keyEncoding:'utf8', valueEncoding: 'json' })); 
// you may invoke listen...
// server.close() // ...and close. 

export class BitcoinIndexd {
  constructor(leveldbFile, rpcUrl, zmqTpc) {
    this.db = levelup(leveldown(leveldbFile))
    this.indexd = new Indexd(this.db, rpcUrl)
    this.zmqTpc = zmqTpc
  }

  get() {
    return this.indexd
  }

  view() {
    // const db =level('/Users/liyu/Github/indexd/_dist')
    const server = createViewerServer(this.db); // This returns a Node.JS HttpServer.
    server.listen(9090);
  }

  initialize(callback) {
    function errorSink(err) {
      if (err) debug(err)
    }
    this.db.open({
      writeBufferSize: 1 * 1024 * 1024 * 1024 // 1 GiB
    }, (err) => {
      console.log('db open....', this.zmqTpc)
      if (err) return callback(err)
      let zmqSock = socket('sub')
      zmqSock.connect(this.zmqTpc)
      zmqSock.subscribe('hashblock')
      zmqSock.subscribe('hashtx')

      let sequences = {}
      zmqSock.on('message', (topic, message, sequence) => {
        topic = topic.toString('utf8')
        message = message.toString('hex')
        sequence = sequence.readUInt32LE()
        debug(`zmq message topic:${topic} message:${message} sequence:${sequence}`)
        callback({
          topic,
          message,
          sequence
        })

        if (sequences[topic] === undefined) sequences[topic] = sequence
        else sequences[topic] += 1

        if (sequence !== sequences[topic]) {
          if (sequence < sequences[topic]) debugZmq(`bitcoind may have restarted`)
          else debugZmq(`${sequence - sequences[topic]} messages lost`)
          sequences[topic] = sequence
          this.indexd.tryResync(errorSink)
        }

        switch (topic) {
          case 'hashblock': {
            debugZmq(topic, message)
            return this.indexd.tryResync(errorSink)
          }

          case 'hashtx': {
            debugZmqTx(topic, message)
            return this.indexd.notify(message, errorSink)
          }
        }
      })

      setInterval(() => this.indexd.tryResync(errorSink), 6000) // attempt every minute
      this.indexd.tryResync(errorSink)
      this.indexd.tryResyncMempool(errorSink) // only necessary once
      callback('zmq runing...')
    })
  }
}
