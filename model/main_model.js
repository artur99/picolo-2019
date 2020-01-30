const uuidv4 = require('uuid/v4')
const Datastore = require('nedb')
const SHA2 = require("sha2")

const db_users = new Datastore({ filename: './model/users.db', autoload: true })
const db_websites = new Datastore({ filename: './model/websites.db', autoload: true })

db_users.persistence.setAutocompactionInterval(30 * 60 * 1000)
db_websites.persistence.setAutocompactionInterval(10 * 60 * 1000)

var user = {
    check_login: function(email, password, next) {
        email = email.trim()
        password = password.trim()

        let hashed_pw = SHA2.sha224(password).toString('hex')

        db_users.findOne({ email: email, password: hashed_pw }, function (err, doc) {
            if(err) {
                return next('Error connecting to database.')
            }
            if(doc == null) {
                return next('Invalid email or password.')
            }

            doc.password = undefined
            next(null, doc)
        })
    },
    register_user: function(name, email, password, cpassword, next) {
        name = name.trim()
        email = email.trim()
        password = password.trim()
        cpassword = cpassword.trim()

        if(name.length < 2) {
            return next('Name is too short.')
        }
        if(email.length < 3) {
            return next('Email address is too short.')
        }
        if(password.length < 6) {
            return next('Password is too short.')
        }
        if(password != cpassword) {
            return next('Passwords do not match.')
        }

        db_users.findOne({ email: email }, function (err, doc) {
            if(!err && doc != null) {
                return next('Email already registered.')
            }

            let hashed_pw = SHA2.sha224(password).toString('hex')

            db_users.insert({
                name: name,
                email: email,
                password: hashed_pw
            }, function (err, newDoc) {
                if(err) {
                    return next("Error inserting in db: " + err.message)
                }
                newDoc.password = undefined
                next(null, newDoc)
            })
        })
    }
}

var websites = {
    add_website: function(user_id, data, next) {

        var name = data.name.trim()
        var patterns = data.patterns.trim()
        var config = {
            webp_compression: data.config_webp_compression ? data.config_webp_compression == 'true' : true,
            gzip_compression: data.config_gzip_compression ? data.config_gzip_compression == 'true' : true,
            cachecontrol: data.config_cachecontrol ? data.config_cachecontrol == 'true' : true,
            localcache: data.config_localcache ? data.config_localcache == 'true' : true,
            pixel_compression: data.config_pixel_compression ? data.config_pixel_compression == 'true' : true,
            resize: data.config_resize ? data.config_resize == 'true' : true,
            pixel_compression_type: data.config_pixel_compression_type ? data.config_pixel_compression_type : 'lossless',
        }

        if(name.length < 2) {
            return next('Website name is too short.')
        }

        if(patterns.length < 1) {
            return next('No valid patterns...')
        }
        if(data.id == 0) {
            var api_key = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '')
            db_websites.insert({
                name: name,
                user_id: user_id,
                api_key: api_key,
                patterns: patterns,
                config: config,
                stats: {
                    total_saved_traffic: 0,
                    total_served_images: 0,
                    total_requests: 0,
                }
            }, function (err, newEntry) {
                if(err) {
                    return next("Error inserting in db: " + err.message)
                }
                next(null, newEntry)
            })
        }
        else {
            db_websites.update({_id: data.id}, {
                $set: {
                    name: name,
                    patterns: patterns,
                    config: config
                }
            }, function (err, newEntry) {
                if(err) {
                    return next("Error updating in db: " + err.message)
                }
                next(null, newEntry)
            })
        }
    },
    list_websites: function(user_id, next) {
        db_websites.find({user_id: user_id}, function(err, docs) {
            if(err) return next("Error fetching from db: " + err.message)

            next(null, docs)
        })
    },
    get_website: function(user_id, website_id, next) {
        db_websites.findOne({user_id: user_id, _id: website_id}, function(err, doc) {
            if(err) return next("Error fetching from db: " + err.message)
            if(!doc) return next("Error: website not found in your account.")
            next(null, doc)
        })
    },
    get_website_by_api_key: function(api_key, next) {
        db_websites.findOne({api_key: api_key}, function(err, doc) {
            if(err) return next("Error fetching from db: " + err.message)
            if(!doc) return next("Error: invalid api_key.")
            next(null, doc)
        })
    },
    delete_website: function(user_id, website_id, next) {
        db_websites.remove({
            _id: website_id,
            user_id: user_id,
        }, function(err, num) {
            if(err) return next("Error deleting from db: " + err.message)
            if(num == 0) {
                return next("Error: you don't have access or this website doens't exist.")
            }
            next(null, 'ok')
        })
    },
    stats_add_requested: function(api_key, next) {
        db_websites.update({ api_key: api_key }, {$inc: { "stats.total_requests": 1 }}, { multi: false }, function (err) {
            if(err) return next(err)
            return next(null, "ok")
        })
    },
    stats_add_serevd: function(api_key, saved_size, next) {
        db_websites.update({ api_key: api_key }, {$inc: { "stats.total_saved_traffic": saved_size, "stats.total_served_images": 1 }}, { multi: false }, function (err) {
            if(err) return next(err)
            return next(null, "ok")
        })
    },
}


module.exports = {
    user: user,
    websites: websites
}
