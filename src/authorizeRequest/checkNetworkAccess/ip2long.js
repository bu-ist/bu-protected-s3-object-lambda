// Description: Convert IP address to long and vice versa
// https://github.com/wangwenming/ip2long/blob/master/index.js

const multipliers = [0x1000000, 0x10000, 0x100, 1];

function ip2long(ip) {
    let longValue = 0;
    ip.split('.').forEach(function(part, i) {longValue += part * multipliers[i];});
    return longValue;
}

function long2ip(longValue) {
    return multipliers.map(function(multiplier) {
        return Math.floor((longValue % (multiplier * 0x100)) / multiplier);
    }).join('.');
}

module.exports = { ip2long, long2ip };