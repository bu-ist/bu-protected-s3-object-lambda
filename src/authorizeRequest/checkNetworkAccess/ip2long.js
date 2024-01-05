// Description: Convert IP address to long and vice versa
// https://github.com/wangwenming/ip2long/blob/master/index.js

const multipliers = [0x1000000, 0x10000, 0x100, 1];

function ip2long(ip) {
  let longValue = 0;
  ip.split('.').forEach((part, i) => { longValue += part * multipliers[i]; });
  return longValue;
}

function long2ip(longValue) {
  return multipliers.map((multiplier) => Math.floor((longValue % (multiplier * 0x100)) / multiplier)).join('.');
}

export { ip2long, long2ip };
