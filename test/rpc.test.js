let rpcUtil = require('../rpc')
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


rpcUtil.mempool(rpc('http://127.0.0.1:18443'), (err, res) => {
    console.log(err, res)
})


// function rpcd (rpc, method, params, done) {
//     debug(method, params)
//     rpc(method, params, (err, result) => {
//       if (err) debug(method, params, err)
//       if (err) return done(err)

//       done(null, result)
//     })
//   }

// const rpc = (rpcUrl) => {
//     return require('yajrpc/qup')({
//         url: rpcUrl,
//         user: 'test',
//         pass: 'testpwd',
//         batch: 500,
//         concurrent: 16
//     })
// }



// rpc('http://127.0.0.1:18443/')('getbestblockhash', [], (err, result) => {
//     console.log(err, result)
// })
