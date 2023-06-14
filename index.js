let leveldown = require('leveldown')
let levelup = require('levelup')
let Indexd = require('./indexd')
let zmq = require('zeromq')

// const rpc = (rpcUrl) => {
//   return require('yajrpc/qup')({
//     url: rpcUrl,
//     auth: "test:testpwd",
//     batch: process.env.RPCBATCHSIZE || 500,
//     concurrent: process.env.RPCCONCURRENT || 16
//   })
// }

const rpc = (rpcUrl) => {
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
          console.log('wallet', rpcUrl)
          fetch(rpcUrl, requestOptions).then(async (res) => { 
              if (res.status === 401) return callback(new Error('Unauthorized')) 
              let { error, result } = await res.json()
              debugger
              if (error) return callback(new Error(error.message || error.code))
              if (result === undefined) return callback(new TypeError('Missing RPC result'))

              callback(null, result)
          })
      } catch (e) {
          console.log('error', e)
          throw e
      }
  }
}


module.exports = class BitcoinIndexd {
  constructor(leveldbFile, rpcUrl, zmqTpc) {
    this.db = leveldown(leveldbFile)
    this.rpc = rpc(rpcUrl)
    this.indexd = new Indexd(this.db, this.rpc)
    this.zmqTpc = zmqTpc
  }

  get() {
    return this.indexd
  }

  getlevelup() {
    return levelup(this.db)
  }

  initialize(callback) {
    function errorSink(err) {
      if (err) debug(err)
    }
    this.db.open({
      writeBufferSize: 1 * 1024 * 1024 * 1024 // 1 GiB
    }, (err) => {
      if (err) return callback(err)
      let zmqSock = zmq.socket('sub')
      zmqSock.connect(this.zmqTpc)
      zmqSock.subscribe('hashblock')
      zmqSock.subscribe('hashtx')

      let sequences = {}
      zmqSock.on('message', (topic, message, sequence) => {
        topic = topic.toString('utf8')
        message = message.toString('hex')
        sequence = sequence.readUInt32LE()

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

      setInterval(() => indexd.tryResync(errorSink), 60000) // attempt every minute
      this.indexd.tryResync(errorSink)
      this.indexd.tryResyncMempool(errorSink) // only necessary once
      callback()
    })
  }
}
