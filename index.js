const interface_server = require('./interface/interface_server')
const api_server = require('./api/api_server')


api_server.run(8007)

interface_server.run(3008, "http://localhost:8007")
