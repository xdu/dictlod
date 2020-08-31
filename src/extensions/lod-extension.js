const path = require('path')
const fs = require('fs')

const btn_part1 = '<a class="resp-sharing-button__link" href="sound://'
const btn_part2 = '.mp3"><div class="resp-sharing-button resp-sharing-button--twitter resp-sharing-button--small"><div aria-hidden="true" class="resp-sharing-button__icon resp-sharing-button__icon--solid"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512.01 512.01"><g><path d="m234.603 46.947-134.809 82.058h-84.794c-8.284 0-15 6.716-15 15v224c0 8.284 6.716 15 15 15h84.794l134.808 82.058c29.996 18.259 68.398-3.311 68.398-38.439v-341.238c0-35.116-38.394-56.703-68.397-38.439zm-204.603 112.058h59v194h-59zm243 267.619c0 11.698-12.787 18.908-22.8 12.813l-131.2-79.862v-207.14l131.2-79.861c9.995-6.084 22.8 1.091 22.8 12.813z"/><path d="m345.678 217.114c-5.858 5.858-5.858 15.355 0 21.213 9.77 9.771 9.771 25.584 0 35.355-5.858 5.858-5.858 15.355 0 21.213 5.857 5.858 15.355 5.859 21.213 0 21.444-21.444 21.444-56.337 0-77.781-5.858-5.858-15.356-5.858-21.213 0z"/><path d="m412.146 171.86c-5.857-5.858-15.355-5.858-21.213 0s-5.858 15.355 0 21.213c34.701 34.701 34.701 91.164 0 125.865-5.858 5.858-5.858 15.355 0 21.213 5.857 5.858 15.355 5.859 21.213 0 46.398-46.398 46.398-121.893 0-168.291z"/><path d="m457.4 126.605c-5.857-5.858-15.355-5.858-21.213 0s-5.858 15.355 0 21.213c60.666 60.666 60.666 155.709 0 216.375-5.858 5.858-5.858 15.355 0 21.213 5.857 5.858 15.355 5.859 21.213 0 72.774-72.774 72.851-185.95 0-258.801z"/></g></svg></div></div></a>'

const { cosmiconfigSync } = require( 'cosmiconfig' )
const explorerSync = cosmiconfigSync( 'lod' )
const result = explorerSync.search()

if (! result.config) {
    throw "Config file is not found."
}

const cache_dir = path.join(result.config.baseDir, result.config.cache)
const audio_dir = path.join(result.config.baseDir, result.config.audio)

module.exports = async toolbox => {
    
    const getart = async ( artid ) => {

        let cache = path.join( cache_dir, artid + ".html" )

        if (fs.existsSync(cache)) {
            const contents =  fs.readFileSync(cache)

            return contents.toString()
        }

        const api = toolbox.http.create({
            baseURL: 'https://www.lod.lu',
            headers: { 
                'referer': 'https://www.lod.lu/',
                'sec-fetch-dest': 'iframe',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'same-origin',
                'sec-fetch-user': '?1'
            }
        })

        const { ok, data } = await api.get('php/getart.php', { artid: artid + '.xml' })

        fs.writeFileSync(cache, data)

        return data
    }

    const getaudio = async ( artid ) => {

        let fn = artid.toLowerCase() + '.mp3'
        let filepath = path.join(audio_dir, fn)

        if (fs.existsSync(filepath)) {
            return fn
        }

        let url = '/audio/' + fn
        
        const api = toolbox.http.create({
            baseURL: 'https://www.lod.lu',
            responseType: 'arraybuffer'
        })

        const { ok, data } = await api.get( url )

        fs.writeFileSync(filepath, data, 'binary')
        return fn
    }

    const replace_css = ( html ) => {
        return html.replace('href="./../lod.css?191115"', 'href="lod.css"')
    }

    const replace_link = ( html ) => {
        const regex = /<a class="lu_link" href=[^>]*>([^<]*)<\/a>/g
        return html.replace(regex, '<span class="lu_link">$1</span>')
    }

    const replace_btns = ( html, artid ) => {
        const regex = /<div class="ftm-buttons">.*/g
        return html.replace(regex, '<div class="ftm-buttons">' 
            + btn_part1 + artid + btn_part2
            + '</div></div></body></html>')
    }

    const build_entry = async ( word ) => {
        
        if (word.link) {
            return word.graphie + toolbox.filesystem.eol + "@@@LINK=" + word.link 
                + toolbox.filesystem.eol + "</>" + toolbox.filesystem.eol
        }

        if (word.art_id) {
            let html = await getart( word.art_id )

            html = replace_css(html)
            html = replace_link(html)
            html = replace_btns(html, word.art_id.toLowerCase())

            return word.graphie + toolbox.filesystem.eol
                + html + "</>" + toolbox.filesystem.eol
        }
        
    }

    const words = ( filename ) => {

        const expat = require('node-expat')

        const parser = new expat.Parser('UTF-8')
        const words = []

        let current_graphie = ''
        let read_graphie = false

        parser.on('startElement', (name, attrs) => {
            if (name === 'graphie') {
                read_graphie = true
            } 
            if (name === 'lod-artikel') {
                
                if (current_graphie === attrs['adress']) {
                    // create a word entry with id
                    words.push({ 'graphie': current_graphie, 'art_id': attrs['id']})
                
                } else {
                    // create a word entry with a link
                    words.push({ 'graphie': current_graphie, 'link': attrs['adress']})
                }
            }
        })

        parser.on('endElement', (name, attrs) => {
            if (name == 'graphie') {
                read_graphie = false
            }
        })

        parser.on('text', (text) => {
            if (read_graphie) {
                current_graphie = text
            }
        })

        return new Promise((resolve, reject) => {
            fs.createReadStream(filename)
                .pipe(parser)
                .on('end', () => resolve(words))
        })
    }

    toolbox.lod = { getart, getaudio, words, build_entry }
}