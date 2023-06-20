import leveldown from 'leveldown';
import request from 'supertest';
import * as bitcoinjs from 'bitcoinjs-lib'
import * as ecc from 'tiny-secp256k1';
bitcoinjs.initEccLib(ecc);
import { Indexd } from '../db/indexd.js'
import ScriptIndex, { SCRIPTTIP } from '../db/indexes/script.js'
let DBLIMIT = 440 // max sequential leveldb walk

const rpcUrl = 'http://127.0.0.1:18443'
const leveldbFile = '/Users/liyu/Github/indexd/_dist'
import { createApiServer } from './index.js'

const dbdown = leveldown(leveldbFile);
(async => {

  // const address = 'bcrt1pnveqfky8jkkwu5tw58tt07qkr54wt9r26hnq69ycpg7c5jml4edqdsdupz'
  // const script = bitcoinjs.address.toOutputScript(address, bitcoinjs.networks.regtest)
  // console.log(script)

  // return
  dbdown.open({
    writeBufferSize: 1 * 1024 * 1024 * 1024 // 1 GiB
  }, async (err) => {
    const indexd = new Indexd(dbdown, rpcUrl)
    const app = createApiServer(indexd)
    // const response = await request(app).get('/');
    // console.log(response)
  })
})();


  // 添加中间件
  // router.use((req, res, next) => {
  //   const { address, txid, id } = req.params
  //   if (address) {
  //     addressWare(req, res, next)
  //   }
  //   if (txid) {
  //     hexWare(req, res, next)
  //   } 
  // });