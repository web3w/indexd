// let debug = require('debug')('db')
// import typeforce, { typef.maybe, UInt53 } from 'typeforce'
import { typeforce as typef } from './indexes/types.js'
let NIL = Buffer.alloc(0)

function atomic() {
  let batch = this.batch()

  //  debug('atomic')
  // console.log('atomic')
  return {
    del: del.bind(batch),
    put: put.bind(batch),
    write: (callback) => batch.write(callback)
  }
}

function del(type, key, callback) {
  typef(type.keyType, key)
  key = type.key.encode(key)

  //    debug('del', key.length)
  return this.del(key, callback)
}

function get(type, key, callback) {
  typef(type.keyType, key)
  key = type.key.encode(key)

  this.get(key, (err, value) => {
    if (err && (/NotFound/).test(err)) return callback()
    if (err) return callback(err)
    if (!type.value) return callback()

    callback(null, type.value.decode(value))
  })
}

function put(type, key, value, callback) {
  typef(type.keyType, key)
  typef(type.valueType, value)

  key = type.key.encode(key)
  value = type.value ? type.value.encode(value) : NIL
  //    debug('put', key.length, value.length)

  return this.put(key, value, callback)
}

function iterator(type, options, forEach, callback) {
  typef({
    gt: typef.maybe(type.keyType),
    gte: typef.maybe(type.keyType),
    lt: typef.maybe(type.keyType),
    lte: typef.maybe(type.keyType),
    limit: typef.maybe(typef.UInt53)
  }, options)

  // don't mutate
  options = Object.assign({}, options)
  options.gt = options.gt && type.key.encode(options.gt)
  options.gte = options.gte && type.key.encode(options.gte)
  options.lt = options.lt && type.key.encode(options.lt)
  options.lte = options.lte && type.key.encode(options.lte)
  if (!(options.gt || options.gte)) return callback(new RangeError('Missing minimum'))
  if (!(options.lt || options.lte)) return callback(new RangeError('Missing maximum'))

  let iterator = this.iterator(options)

  function loop(err, key, value) {
    // NOTE: ignores .end errors, if they occur
    if (err) return iterator.end(() => callback(err))
    if (key === undefined || value === undefined) return iterator.end(callback)

    key = type.key.decode(key)
    value = type.value ? type.value.decode(value) : null
    forEach(key, value, iterator)

    iterator.next(loop)
  }

  iterator.next(loop)
}

export function dbwrapper(db) {
  return {
    atomic: atomic.bind(db),
    del: del.bind(db),
    get: get.bind(db),
    iterator: iterator.bind(db),
    put: put.bind(db)
  }
}
