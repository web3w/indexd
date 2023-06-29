// ---------------------- redis缓存数据库配置 ------------------ //
let redisConfig = {
    host: "localdb.bibox360.com",
    port: "6379",
    max_clients: 300,
    perform_checks: true,
    password: 'Biiigle1234',
    db: 0,
    options: {
        auth_pass: "Biiigle1234"
    }
} 

/**
 * 使用ioredis
 */

import Redis from 'ioredis';

export default client = new Redis(redisConfig);


client.on("error", function (err) {
    // client.quit()
    console.error("Error " + err);
    // client = Redis.createClient(redisConfig);
});


// module.exports = client

// let promisableFns = ["hget","hset"]

// module.exports = new Proxy(redis, {
//     get: (target, property) => {
//         if(promisableFns.includes(property)){
//             let foo  =target[property]
//             console.log(foo)
//             return promisify(target[property])
//         }else{
//             return target[property];
//         }
//     }
// });


/**
 * redis连接池
 * 用法 ：
 * get  -- get(key, cb)
 * set  -- set(key, value, callback)
 * expire -- expire(key, seconds, callback)
 * del -- del(key, callback)
 * hget -- hget(key, field, callback)
 * hgetall -- hgetall(key, callback)
 * hset -- hset(key, field, value, callback)
 * hdel -- hdel(key, [fields], callback)
 * brpop -- brpop(key, cb)
 * blpop -- blpop(key, cb)
 * rpush -- rpush(key, value, callback)
 * lpush -- lpush(key, value, callback)
 */











