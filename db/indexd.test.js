import leveldown from 'leveldown';
import ScriptIndex, { SCRIPTTIP } from '../db/indexes/script.js'
let DBLIMIT = 440 // max sequential leveldb walk 
const leveldbFile = '/Users/liyu/Github/indexd/_dist'
import { dbwrapper } from './dbwrapper.js'
import { Indexd } from './indexd.js';

const dbdown = leveldown(leveldbFile);
const rpcUrl = 'http://127.0.0.1:18443';

// mpeNdX1Ac1mobtYh2ugwrQu226xRe5PaUy
const scId = "39b4367ae23dec56fb21fd45d0fb5ffe15505bcdf0f435dccecde693b23fc6fe";
(async => {
  dbdown.open({
    writeBufferSize: 1 * 1024 * 1024 * 1024 // 1 GiB
  }, (err) => {
    const indexd = new Indexd(dbdown, rpcUrl)
    const db = indexd.db

    // setInterval(() => this.indexd.tryResync(errorSink), 6000) // attempt every minute
    function errorSink(err) {
      if (err) console.error(err)
    }
    indexd.tryResync(errorSink)

    return

    indexd.utxosByScriptRange({
      scId, heightRange: [0, 600], mempool: true
    }, DBLIMIT, (err, data) => {
      console.log('utxosByScriptRange', err, data)
    })

    db.get(SCRIPTTIP, {}, function (err, data) {
      console.log('db get key:', data)
    })

    indexd.latestFeesForNBlocks(506, (err, results) => {

      console.log("latestFeesForNBlocks", err, results)
      // res.easy(err, results)
    })
  })
})();


