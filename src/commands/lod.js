const fs = require( 'fs' )
const path = require( 'path' )

module.exports = {
    run: async toolbox => {

        if (! toolbox.parameters.options['i']) {
            toolbox.print.error( "Input file is not specified." ) 
            process.exit(-1)
        }

        // Wordlist file contains all the luxembourgisch words in xml format, it can be 
        // downloaded from https://data.public.lu/en/
        let wordlist_file = toolbox.parameters.options['i']

        if (! fs.existsSync( wordlist_file )) {
            toolbox.print.error( "Input file does not exist : " + wordlist_file ) 
            process.exit(-2)
        }

        // Load the word list
        const words = await toolbox.lod.words( wordlist_file )
        toolbox.print.info("Total " + words.length + " entires to process")

        // Output file
        const lod = fs.openSync( path.join("lod", "lod.txt"), "w+", "0644" )

        let prev_stat = 0
        for (let i = 0; i < words.length; i++) {
            let word = words[i]

            // Get the word explaination
            const entry = await toolbox.lod.build_entry( word )

            // Get the word audio file if the word is not a link to aother word
            if (word.art_id) {
                await toolbox.lod.getaudio( word.art_id, '.' )
            }

            // Append to the output file
            fs.appendFileSync(lod, entry)
        
            // Print the progress by the scale of 10.
            let curr_stat = Math.round((i / words.length) * 100)

            if (curr_stat % 10 === 0 && curr_stat != prev_stat) {
                toolbox.print.info(curr_stat + " % completed")
                prev_stat = curr_stat
            }
        }
        fs.closeSync(lod)
    }
}