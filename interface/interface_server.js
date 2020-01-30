const express = require('express')
const compression = require('compression')
const nunjucks = require('nunjucks')
const session = require('express-session')

const main_model = require('../model/main_model.js')


const app = express()
var API_URL = false

app.use(session({
    secret: 'random noisy words___@)(!#)',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}))

nunjucks.configure(__dirname + '/templates', {
    autoescape: true,
    watch: true,
    express: app,
})

app.use(compression())
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ limit: "50mb", extended: true }))

// app.use('/favicon.ico', express.static(__dirname + '/assets/ico.png'))
app.use('/assets/', express.static(__dirname + '/assets/', {
    etag: true,
    maxage: '1h'
}))


app.get('/', (req, res) => res.redirect('/login'))

app.get('/login', (req, res) => {
    if(req.session.loggedin)
        return res.redirect('/dashboard')

    res.render('login.html')
})
app.post('/login', (req, res) => {
    let body = req.body

    main_model.user.check_login(body.email, body.password, function(err, user_info) {
        if(err) {
            res.json({error: err})
            return
        }
        req.session.loggedin = true
        req.session.user_info = user_info
        res.json({success: 'Logged in.'})
    })
})

app.get('/register', (req, res) => {
    if(req.session.loggedin)
        return res.redirect('/dashboard')

    res.render('register.html')
})
app.post('/register', (req, res) => {
    let body = req.body

    main_model.user.register_user(body.name, body.email, body.password, body.cpassword, function(err, user_info) {
        if(err) {
            res.json({error: err})
            return
        }
        req.session.loggedin = true
        req.session.user_info = user_info
        res.json({success: 'Logged in.'})
    })

})

app.get('/logout', (req, res) => {
    req.session.destroy(function(err) {
        res.redirect('/login')
    })
})

app.get('/dashboard', (req, res) => {
    if(!req.session.loggedin)
        return res.redirect('/login')

    if(!req.session.user_info || !req.session.user_info._id)
        return res.redirect('/logout')

    let user_name = req.session.user_info.name

    res.render('dash.html', {user_name: user_name})
})
app.get('/dashboard/add', (req, res) => {
    if(!req.session.loggedin)
        return res.redirect('/login')

    let user_name = req.session.user_info.name

    res.render('dash_website.html', {user_name: user_name, id: 0, s_title: 'Add website', b_btn: 'Add website'})
})
app.get('/dashboard/edit', (req, res) => {
    if(!req.session.loggedin)
        return res.redirect('/login')

    let user_name = req.session.user_info.name

    res.render('dash_website.html', {user_name: user_name, id: req.query.id, s_title: 'Edit website', b_btn: 'Save'})
})
app.get('/dashboard/view', (req, res) => {
    if(!req.session.loggedin)
        return res.redirect('/login')

    let user_id = req.session.user_info._id
    let user_name = req.session.user_info.name

    main_model.websites.get_website(user_id, req.query.id, function(err, entry) {
        if(err) {
            return res.json({error: err})
        }

        let total_saved = entry.stats.total_saved_traffic
        let unit = 'B'
        if(total_saved > 1024) {
            total_saved = parseInt(total_saved / 1024)
            unit = 'KB'
        }
        if(total_saved > 1024) {
            total_saved = parseInt(total_saved / 1024)
            unit = 'MB'
        }
        if(total_saved > 1024) {
            total_saved = parseInt(total_saved / 1024)
            unit = 'GB'
        }

        res.render('dash_view.html', {
            user_name: user_name,
            s_title: 'View website',
            api_key: entry.api_key,
            website_name: entry.name,
            website_patterns: entry.patterns,
            website_patterns_str: entry.patterns.split("\n").map(x => x.trim()).filter(x => x.length).join(","),
            api_url: API_URL,
            stats: entry.stats,
            total_saved: total_saved + unit,
        })
    })
})
app.get('/dashboard/code', (req, res) => {
    if(!req.session.loggedin)
        return res.redirect('/login')

    let user_id = req.session.user_info._id
    let user_name = req.session.user_info.name

    main_model.websites.get_website(user_id, req.query.id, function(err, entry) {
        if(err) {
            return res.json({error: err})
        }

        res.render('dash_code.html', {
            user_name: user_name,
            api_key: entry.api_key,
            website_name: entry.name,
            website_patterns: entry.patterns,
            website_patterns_str: entry.patterns.split("\n").map(x => x.trim()).filter(x => x.length).join(","),
            api_url: API_URL,
        })
    })
})

app.get('/api/website_list', (req, res) => {
    if(!req.session.loggedin) return res.json({error: 'Unathorized access.'})

    let user_id = req.session.user_info._id

    main_model.websites.list_websites(user_id, function(err, list) {
        if(err) {
            return res.json({error: err})
        }

        res.json({'results': list})
    })

})
app.post('/api/website_add', (req, res) => {
    if(!req.session.loggedin) return res.json({error: 'Unathorized access.'})
    let body = req.body
    let user_id = req.session.user_info._id

    main_model.websites.add_website(user_id, body, function(err, entry_info) {
        if(err) {
            return res.json({error: err})
        }
        if(body.id == 0) {
            res.json({success: 'Added successfuly.'})
        }
        else {
            res.json({success: 'Saved successfuly.'})
        }
    })
})
app.post('/api/delete_website', (req, res) => {
    if(!req.session.loggedin) return res.json({error: 'Unathorized access.'})
    let body = req.body
    let user_id = req.session.user_info._id

    main_model.websites.delete_website(user_id, body.id, function(err, ok) {
        if(err) {
            return res.json({error: err})
        }
        res.json({success: 'Deleted successfuly.'})
    })
})


var run = function(port, api_url) {
    API_URL = api_url
    app.listen(port, () => console.log(`Interface server started on ${port}`))
}

module.exports = {
    run: run
}
