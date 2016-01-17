var mongoose = require('mongoose');

module.exports = mongoose.model('sourcePost', {
    data               : {
        note_guid               : String,
        source_provider         : String,
        evernote_id              : String,
        updatedDate             : { type : Date, default: Date.now }
    }
});