// import { compile, UInt32, Null } from 'typeforce'
import { tip as _tip,typeforce as typef} from './types.js'
import vstruct, { Value, UInt8, UInt32BE, UInt32LE } from 'varstruct'

let MTPPREFIX = 0x83
let MTPTIP = _tip(MTPPREFIX)
let MTP = {
  keyType: typef.compile({
    medianTime: typef.UInt32,
    height: typef.UInt32
  }),
  key: vstruct([
    ['prefix', Value(UInt8, MTPPREFIX)],
    ['medianTime', UInt32BE], // big-endian for lexicographical sort
    ['height', UInt32LE]
  ]),
  valueType:typef.Null
}

class MtpIndex {
  constructor() { }
  tip(db, callback) {
    db.get(MTPTIP, {}, callback)
  }
  connect(atomic, block) {
    let { height, medianTime } = block

    atomic.put(MTP, { medianTime, height })
    atomic.put(MTPTIP, {}, block)
  }
  disconnect(atomic, block) {
    let { height, medianTime } = block

    atomic.del(MTP, { medianTime, height })
    atomic.put(MTPTIP, {}, { blockId: block.prevBlockId, height })
  }
}




export default MtpIndex
const _types = {
  data: MTP,
  tip: MTPTIP
}
export { _types as types }
