import { createRequire } from 'module'; 
import vstruct, { Value, UInt8, String, UInt32LE } from 'varstruct'
// import { HexN, UInt32 } from 'typeforce' 
const require = createRequire(import.meta.url);
export const typeforce = require('typeforce');



export function tip(prefix) {
  return {
    keyType: {},
    key: vstruct([
      ['prefix', Value(UInt8, prefix)]
    ]),
    valueType: {
      blockId: typeforce.HexN(64),
      height: typeforce.UInt32
    },
    value: vstruct([
      ['blockId', String(32, 'hex')],
      ['height', UInt32LE]
    ])
  }
}

// export default { tip }
