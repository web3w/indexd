'use strict';

// let redis_client = require("./redis.client");
import * as redis_client from "./redis.client.js";

let getKey = (key) => {
    return `WA.${key}`
}

let getAddressKey = (symbol, addr) => {
    return getKey(`${symbol}.${addr}`)
}
export class RedisBlockTx {
    constructor() {
        this.client = redis_client
        this.BLOCK_HEIGHT_KEY = "WA.block.height"
        // this.BlOCK_ADDRESS_KEY = `WA.${symbol}`
    }

    async getHashInfo(key, h_key) {
        let _jsonStr = await this.client.hget(key, h_key).catch(err => {
            throw err
        });
        return JSON.parse(_jsonStr)
    }

    async setHashInfo(key, h_key, h_value) {
        return this.client.hset(key, h_key, h_value).catch(err => {
            throw err
        })
    }

    async delHashInfo(key) {
        return this.client.del(key).catch(err => {
            throw err
        })
    }

    async getHashAll(key) {
        return this.client.hgetall(key).catch(err => {
            throw err
        })
    }

    async setScanInfo(chainName, chain_height, job_height) {
        try {
            let _info = {
                "chain": chainName,
                "chain_height": chain_height,
                "job_height": job_height,
                "update_timestamp": new Date().getTime()
            }
            await this.setBlockHeight(chainName, _info).catch(err => {
                throw err
            })
            return _info
        } catch (e) {
            throw e
        }
    }

    // 设置 区块高度信息
    async setBlockHeight(h_key, h_value) {
        return this.setHashInfo(this.BLOCK_HEIGHT_KEY, h_key, JSON.stringify(h_value)).catch(err => {
            throw err
        })
    }

    //获取 区块高度信息
    async getJobInfo(h_key) {
        return this.getHashInfo(this.BLOCK_HEIGHT_KEY, h_key).catch(err => {
            throw err
        })
    }

    // 设置Token 对应的callback地址
    async setSymbolCallBack(callback_url) {
        try {
            let bar = await this.getHashInfo(this.BLOCK_HEIGHT_KEY, this.symbol).catch(err => {
                throw err
            })
            bar.callback_url = callback_url

            let _result = await this.setHashInfo(this.BLOCK_HEIGHT_KEY, this.symbol, JSON.stringify(bar)).catch(err => {
                throw err
            });
            return _result
        } catch (e) {
            throw e
        }
    }

    // 允许外部控制扫链高度
    async setJobHeight(h_key, job_height) {
        try {
            let bar = await this.getHashInfo(this.BLOCK_HEIGHT_KEY, h_key).catch(err => {
                throw err
            })
            // 验证高度
            bar.job_height = bar.chain_height > job_height ? job_height : bar.chain_height

            let _result = await this.setHashInfo(this.BLOCK_HEIGHT_KEY, h_key, JSON.stringify(bar)).catch(err => {
                throw err
            });
            return _result
        } catch (e) {
            throw e
        }
    }

    // 保存扫链的tx信息
    async setAddressTx(symbol, address, tx) {
        try {
            let _key = getAddressKey(symbol, address)
            let _result = await this.setHashInfo(_key, tx.id, JSON.stringify(tx)).catch(err => {
                throw err
            });
            return _result
        } catch (e) {
            throw e
        }
    }

    // 删除地址信息
    async delAddress(symbol, address) {
        try {
            let _key = getAddressKey(symbol, address)
            let _result = await this.delHashInfo(_key).catch(err => {
                throw err
            });
            return _result
        } catch (e) {
            throw e
        }
    }

    /**
     * 查找是否存在地址对应的key
     * @param rediskeys
     * @returns {Promise<void>}
     */
    async existsAddress(rediskeys) {
        try {
            return this.client.send_command("EXISTS", rediskeys).catch(err => {
                throw err
            })
        } catch (e) {
            throw e
        }

    }

    // 批量检查是否有需要监控的交易
    async checkAddressList(symbol, addrList) {
        try {
            let _keys = addrList.map(addr => getAddressKey(symbol, addr))

            return this.existsAddress(_keys).catch(e => {
                throw e
            })
        } catch (e) {
            throw e
        }
    }

    async checkAddress(symbol, addr) {
        try {
            let _key = getAddressKey(symbol, addr)

            return this.existsAddress(_key).catch(e => {
                throw e
            })
        } catch (e) {
            throw e
        }
    }

    async checkList(addrList) {
        try {
            let _keys = addrList.map(addr => getKey(addr))

            return this.existsAddress(_keys).catch(e => {
                throw e
            })
        } catch (e) {
            throw e
        }
    }

    // 根据名称和地址查询所有的交易记录
    async getAddressTx(symbol, address, tx_id) {
        try {
            let _key = getAddressKey(symbol, address)
            let _result = await this.getHashInfo(_key, tx_id).catch(err => {
                throw err
            });
            return _result
        } catch (e) {
            throw e
        }
    }

    // 获取地址的所有信息
    async getAddressAllTx(symbol, address) {
        try {
            let _key = getAddressKey(symbol, address)
            let _result = await this.getHashAll(_key).catch(err => {
                throw err
            });
            return _result
        } catch (e) {
            throw e
        }
    }

}

