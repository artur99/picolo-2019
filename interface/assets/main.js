var registerFormSubmit = function(form_id, fct) {

    var obj = {

    }

    document.querySelectorAll(form_id)
    .forEach(form => form.onsubmit = function(e) {
        if(form.classList.contains('disabled')) return false

        var data = {};
        var formdata = new FormData(e.target)
        Array.from(formdata.entries()).map(e => data[e[0]] = e[1])

        fct(form, data, obj)
        console.log("Form " + form_id + " submitted.")
        return false
    })
}

var sendPost = function(url, data, next) {
    let xhr = new XMLHttpRequest();

    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.onload = function() {
        if (xhr.status === 200) {
            let resp = xhr.responseText
            try {
                resp = JSON.parse(resp)
            }
            catch(e) {}

            next(null, resp)
        }
        else if (xhr.status !== 200) {
            next(xhr.status);
        }
    }
    var post_str = Object.entries(data)
        .map(x => encodeURIComponent(x[0]) + '=' + encodeURIComponent(x[1]))
        .join('&')

    xhr.send(post_str)
}
var sendGet = function(url, next) {
    let xhr = new XMLHttpRequest();

    xhr.open('GET', url);
    xhr.onload = function() {
        if (xhr.status === 200) {
            let resp = xhr.responseText
            try {
                resp = JSON.parse(resp)
            }
            catch(e) {}

            next(null, resp)
        }
        else if (xhr.status !== 200) {
            next(xhr.status);
        }
    }

    xhr.send()
}

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('textarea').forEach(el => {
        var plc = el.getAttribute('placeholder')
        if(plc) {
            el.setAttribute('placeholder', plc.replace(/\\n/g, '\n'))
        }
    })
})

registerFormSubmit("#form_login", function(form, data) {
    sendPost('/login', data, function(err, resp) {
        if(resp && resp.error) {
            return alert(resp.error)
        }
        else if(resp && resp.success) {
            window.location.href = '/dashboard'
        }
    })
})

registerFormSubmit("#form_register", function(form, data) {
    sendPost('/register', data, function(err, resp) {
        if(resp && resp.error) {
            return alert(resp.error)
        }
        else if(resp && resp.success) {
            window.location.href = '/dashboard'
        }
    })
})

registerFormSubmit("#add_update_website", function(form, data) {
    var orig_obj = {
        config_webp_compression: false,
        config_gzip_compression: false,
        config_cachecontrol: false,
        config_localcache: false,
        config_pixel_compression: false,
        config_resize: false
    }

    for(let key of Object.keys(orig_obj)) {
        if(!data[key]) data[key] = orig_obj[key]
    }
    for(let key of Object.keys(data)) {
        if(data[key] === 'on') data[key] = true
    }

    sendPost('/api/website_add', data, function(err, resp) {
        if(resp && resp.error) {
            return alert(resp.error)
        }
        else if(resp && resp.success) {
            console.log(data)
            if(data.id != '0') {
                return window.location.reload()
            }
            window.location.href = '/dashboard'
        }
    })
})


document.addEventListener('DOMContentLoaded', function() {
    let el = document.querySelector('#load_with_websites')
    if(!el) return

    var genTableRow = function(row) {
        data = '<tr>'
        data+= '<td>' + row._id.slice(-5) + '</td>'
        data+= '<td>' + row.name + '</td>'
        data+= '<td>' + row.api_key + '</td>'

        data+= '<td>'
        data+= '<a href="/dashboard/view?id=' + row._id + '" title="View" class="a-btn"><i class="material-icons">list_alt</i></a> '
        data+= '<a href="/dashboard/edit?id=' + row._id + '" title="Settings" class="a-btn"><i class="material-icons">edit</i></a> '
        data+= '<a href="#" title="Delete" class="a-btn delete-website" data-id="' + row._id + '"><i class="material-icons">delete</i></a> '
        data+= '<a href="/dashboard/code?id=' + row._id + '" title="Code" class="a-btn"><i class="material-icons">code</i></a>'
        data+= '</td>'

        data+= '</tr>'
        return data
    }

    sendGet('/api/website_list', function(err, resp) {
        if(resp && resp.error) {
            alert(resp.error)
        }
        if(resp && resp.results) {
            let list = resp.results

            if(list.length == 0) {
                el.querySelector('table').style.display = 'none'
                el.querySelector('.info-line').style.display = 'none'
                el.querySelector('.nothingness-paragraph').style.display = 'block'
                return
            }
            el.querySelector('.info-line').style.display = 'block'
            el.querySelector('.nothingness-paragraph').style.display = 'none'

            el.querySelector('tbody').innerHTML = list.map(genTableRow).join('\n')
            el.querySelector('table').style.display = 'block'

            el.querySelectorAll('.delete-website').forEach(x => x.onclick = function(e){
                e.preventDefault();
                var website_id = x.dataset.id
                if(confirm("Are you sure?")) {
                    sendPost('/api/delete_website', {id: website_id}, function() {
                        if(resp && resp.error) {
                            return alert(resp.error)
                        }
                        window.location.reload()
                    })
                }
            })
        }
    })
})

document.addEventListener('DOMContentLoaded', function() {
    let el = document.querySelector('#add_update_website')
    if(!el) return
    let el2 = el.querySelector('[name=id]')
    if(el2.value == '0') return

    sendGet('/api/website_list', function(err, resp) {
        if(resp && resp.error) {
            return alert(resp.error)
        }
        if(resp && resp.results) {
            let info = resp.results.find(x => x._id == el2.value)
            if(!info) {
                alert("Not found...")
            }
            el.querySelector('[name=name]').value = info.name
            el.querySelector('[name=patterns]').value = info.patterns
            el.querySelector('[name=config_webp_compression]').checked = info.config.webp_compression
            el.querySelector('[name=config_gzip_compression]').checked = info.config.gzip_compression
            el.querySelector('[name=config_cachecontrol]').checked = info.config.cachecontrol
            el.querySelector('[name=config_localcache]').checked = info.config.localcache
            el.querySelector('[name=config_pixel_compression]').checked = info.config.pixel_compression
            el.querySelector('[name=config_resize]').checked = info.config.resize

            el.querySelector('[name=config_pixel_compression_type][value=' + info.config.pixel_compression_type + ']').checked = true

        }
    })
})
