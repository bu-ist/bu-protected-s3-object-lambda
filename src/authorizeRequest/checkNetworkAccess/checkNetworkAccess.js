const { ip2long } = require( './ip2long' );
const rangeSets = require( './ranges.json' );

function checkNetworkAccess( rules, headers ) {
    // Destructure the header object to get the shib attributes, with defaults.
    const {
        'X-Bu-Ip-Forwarded-For': userIp = ''
    } = headers;

    // Get the campus names from the rules object that stores network rules, with a default value of an empty array.
    const { ranges = [] } = rules;

    // Extract the network ranges from the campus names in the rule.
    const rangesToCheck = ranges.reduce( ( accumulator, range ) => {
        if ( rangeSets[ range ] ) {
            accumulator = accumulator.concat( rangeSets[ range ] );
        }
        return accumulator;
    }, [] );

    // Check to see if the ip address is in any of the ranges.
    const isAllowed = rangesToCheck.some( ( range ) => {
        const { start, end } = range;

        // Calculate whether the ip address is in the range, by converting the ip address to a number with ip2long.
        const inRange = ip2long( start ) <= ip2long( userIp )
            && ip2long( end ) >= ip2long( userIp );

        return inRange;
    } );

    return isAllowed;
}

module.exports = { checkNetworkAccess };