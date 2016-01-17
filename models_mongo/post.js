var mongoose = require('mongoose');

module.exports = mongoose.model('Post', {
    data               : {
        notebook_guid           : String,
        note_guid               : String,
        post_id                 : String,
        content                 : String,
        title                   : String,
        source_provider         : String,
        dest_provider           : String,
        evernote_id              : String,
        dest_provider_site_id   : String,
        updatedDate             : { type : Date, default: Date.now }
    }
});