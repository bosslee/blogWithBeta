var mongoose = require('mongoose');

module.exports = mongoose.model('User', {
    local               : {
        email           : String,
        password        : String 
    }, 
	evernote            : {
		provider	    : String,	
        id              : String,
        token	        : String,
        shard	        : String,
        notebook_guid       : String
    },
    wordpress           : {
		provider	    : String,	
        id              : String,
        display_name    : String,
        username	    : String,
        email	        : String,
        token_site_id   : String,
        token           : String,
        refreshToken    : String
    },
    meta                : {
        updatedDate     : { type : Date, default: Date.now }
    }
});
