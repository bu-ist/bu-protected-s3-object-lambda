async function authorizeRequest(userRequest) {
    // Check if the user is authorized to access the object.
    const { url, headers } = userRequest;

    if  (!url.includes('__restricted')) {
        // Unrestricted items are always allowed.
        // Will need to account for whole site protections here.
        return true;
    }

    // For now just check for a username in the shib headers.
    return ('X-Bu-Shib-Username' in headers);
    
}

module.exports = { authorizeRequest };