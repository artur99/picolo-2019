const http = require('http')
const url = require('url')
const zlib = require('zlib')

const image_handler = require('./image_handler')

const server = http.createServer()

server.on('request', (req, res) => {
    var urlData = url.parse(req.url, true)
    var queryData = urlData.query


    if(urlData.pathname == '/image') {
        return image_handler(queryData, res)
    }
    else if(urlData.pathname == '/check') {
        return image_handler(queryData, res, true)
    }
    else if(urlData.pathname == '/status') {
        return sendJSON(res, 200, {status: 'ON', info: 'all_working'})
    }


    sendJSON(res, 400, {error: 'Invalid node.'})
})

var sendJSON = function(res, code, obj) {
    res.writeHead(code, {
        'Content-Type': 'text/json'
    })

    res.end(JSON.stringify(obj))
}



var run = function(port) {
    server.listen(port)
    console.log("API Server started on " + port)
}

module.exports = {
    run: run
}
