const request = require('request')
const sharp = require('sharp')
const zlib = require('zlib')

const main_model = require('../model/main_model.js')

const accepted_formats = ['png', 'jpg', 'jpeg', 'tiff', 'gif', 'svg']
const redirect_on_error = true
const width_trehsolds = [320, 720, 1024, 1400, 2500, 3000]
const cache_control_timeout = 60 * 60 * 24 * 30 // 30 zile



const get_image_from_url = function(url, next) {
    request(url, {
        encoding: null,
    }, (err, res, body) => {
        if (err) {
            return next(err)
        }
        next(null, res.headers, body)
    })
}

const gzip_middleware = function(response, next) {
    zlib.gzip(Buffer.from(response.body), function(err, result) {
        if(err) {
            console.log(err)
            return next(err.message)
        }

        response.body = result
        response.headers['Content-Encoding'] = 'gzip'

        next(null, response)
    })
}

const cachecontrol_middleware = function(response, next) {
    var cache_control_string = 'public, max-age=' + cache_control_timeout
    if(response.image_options['original_cachecontrol']) {
        cache_control_string = response.image_options['original_cachecontrol']
    }

    response.headers['Cache-Control'] = cache_control_string

    next(null, response)
}

const image_middleware = function(response, next) {
    var image_options = response.image_options
    var sharp_img = sharp(response.body)

    response.image_options['original_size'] = response.body.length

    sharp_img.metadata().then(metadata => {
        let original_format = metadata.format
        let orig_w = metadata.width
        let orig_h = metadata.height

        response.image_options['original_width'] = orig_w
        response.image_options['original_height'] = orig_h



        response.image_options['output_width'] = orig_w
        response.image_options['output_height'] = orig_h

        if(image_options['resizebyscreen_enabled'] && image_options['screen_size']) {
            let screen_size = image_options['screen_size'].split(',').map(x => parseInt(x))
            let sc_w = screen_size.length > 0 ? screen_size[0] : 0
            let sc_h = screen_size.length > 1 ? screen_size[1] : 0

            if(sc_w && sc_h && orig_w - sc_w > 50 && orig_h - sc_h > 50) {
                // refix_w
                let scw_comp = width_trehsolds.filter(x => x > sc_w)
                sc_w = scw_comp.length ? scw_comp[0] : sc_w


                let ratio = 1
                if(orig_w - sc_w > orig_h - sc_h) {
                    ratio = sc_h / orig_h
                }
                else {
                    ratio = sc_w / orig_w
                }
                let new_w = parseInt(orig_w * ratio)
                let new_h = parseInt(orig_h * ratio)

                sharp_img = sharp_img.resize({
                    width: new_w,
                    height: new_h
                })

                response.image_options['output_width'] = new_w
                response.image_options['output_height'] = new_h
            }
        }

        if(image_options['webp_enabled'] == true) {
            let lossless_on = image_options['compression_enabled'] && image_options['preffered_compression'] == 'lossless'

            sharp_img = sharp_img.webp({lossless: lossless_on})
            response.image_options['output_format'] = 'webp'
            response.image_options['output_compression'] = lossless_on ? 'lossless' : false
        }
        else {
            if(['png', 'gif', 'svg'].includes(image_options['original_format'])) {
                let lossless_on = image_options['compression_enabled'] && image_options['preffered_compression'] == 'lossless'

                sharp_img = sharp_img.png({compressionLevel: lossless_on ? 8 : 0})
                response.image_options['output_format'] = 'png'
                response.image_options['output_compression'] = lossless_on ? 'lossless' : false
            }
            else {
                let lossy_on = image_options['compression_enabled'] && image_options['preffered_compression'] == 'lossy'

                sharp_img = sharp_img.jpeg({quality: lossy_on ? 80 : 100})
                response.image_options['output_format'] = 'jpg'
                response.image_options['output_compression'] = lossy_on ? 'lossy' : false
            }
        }

        sharp_img
            .toBuffer()
            .then(newBuffer => {
                response.headers['Content-Type'] = 'image/webp'
                response.body = newBuffer
                response.image_options['final_size'] = newBuffer.length

                next(null, response)
            })
            .catch(err => {
                console.log(err)
                next(err.message)
            })
    })
}


var middleware_handler = function(response, middlewares, next, i = 0) {
    if(i >= middlewares.length) {
        return next(null, response)
    }

    middlewares[i](response, function(err, new_response) {
        if(err) {
            return next("Middleware " + i + " failed: " + err)
        }

        middleware_handler(new_response, middlewares, next, i + 1)
    })
}

var image_handler = function(queryData, next) {
    let response = {body: '', headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept'
    }, image_options: {}}

    var api_key = queryData.api_key
    var image_url = queryData.url

    main_model.websites.get_website_by_api_key(api_key, function(err, website) {
        if(err) {
            return next(err)
        }

        response.image_options = {
            "gzip_enabled": website.config.gzip_compression,
            "webp_enabled": website.config.webp_compression,
            "resizebyscreen_enabled": website.config.resize,
            "compression_enabled": website.config.pixel_compression,
            "preffered_compression": website.config.pixel_compression_type,
            "cachecontrol_enabled": website.config.cachecontrol,
            "localcache_enabled": website.config.localcache,
            "screen_size": queryData.screen_size ? queryData.screen_size : false
        }

        get_image_from_url(image_url, function(err, headers, body) {
            if(err) return next(err.message)

            var ctype = headers['content-type']
            var cachec = headers['cache-control']
            var orig_format = ctype.split('/').slice(-1)[0]

            if(!accepted_formats.includes(orig_format)) {
                return next('Format not accepted, got: ' + orig_format + '.')
            }

            response.body = body
            response.image_options['original_cachecontrol'] = cachec

            let middleware_list = []

            if(response.image_options['webp_enabled'] || response.image_options['compression_enabled'] || response.image_options['resizebyscreen_enabled'])
                middleware_list.push(image_middleware)

            if(response.image_options['gzip_enabled'])
                middleware_list.push(gzip_middleware)

            if(response.image_options['cachecontrol_enabled'])
                middleware_list.push(cachecontrol_middleware)

            middleware_handler(response, middleware_list, function(err, new_response) {
                next(err, new_response)
            })

        })

        console.log(image_url)
    })

    // res.end("IMAGE")
}

var request_handler = function(queryData, res, simulate = false) {
    main_model.websites.stats_add_requested(queryData.api_key, (err, ok) => null)
    
    image_handler(queryData, function(err, generated_res) {
        if(err) {
            console.log("Error:", err)

            if(redirect_on_error && simulate === false) {
                res.writeHead(302, {
                    'Content-Type': 'text/json',
                    'Location': queryData.url,
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
                })
                return res.end(JSON.stringify({error: err}))
            }
            // nope, simply redirect
            res.writeHead(501, {
                'Content-Type': 'text/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
            })

            return res.end(JSON.stringify({error: err}))
        }

        generated_res.headers['Content-Length'] = generated_res.body.length

        if(simulate) {
            generated_res.body = undefined
            res.writeHead(200, {
                'Content-Type': 'text/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
            })
            res.end(JSON.stringify(generated_res, null, 4))
            return
        }



        let saved_size = Math.max(0, generated_res.image_options['original_size'] - generated_res.image_options['final_size'])

        main_model.websites.stats_add_serevd(queryData.api_key, saved_size, (err, ok) => null)

        res.writeHead(200, generated_res.headers)
        res.end(generated_res.body)
    })
}

module.exports = request_handler
