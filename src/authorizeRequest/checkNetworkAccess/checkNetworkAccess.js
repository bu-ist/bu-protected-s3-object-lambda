import { ip2long } from './ip2long.js';
import { isBehindModShib } from '../getIdentity.js';

function checkNetworkAccess(rules, headers, networkRanges) {
  // Get the user ip address from the headers, with a default value of an empty string.
  // Only the header from the upstream in front of this request is trusted: X-Real-Ip behind
  // mod_shib, X-Cf-Client-Ip behind the edge (spelled the way the SigV4 proxy delivers it).
  const {
    'X-Real-Ip': modShibIp = '',
    'X-Cf-Client-Ip': edgeIp = '',
  } = headers;
  const userIp = isBehindModShib(headers) ? modShibIp : edgeIp;

  // Get the campus names from the rules object that stores network rules, with a default value of an empty array.
  const { ranges = [] } = rules;

  // Extract the network ranges from the campus names in the rule.
  const rangesToCheck = ranges.reduce((accumulator, range) => {
    if (networkRanges[range]) {
      accumulator = accumulator.concat(networkRanges[range]);
    }
    return accumulator;
  }, []);

  // Check to see if the ip address is in any of the ranges.
  const isAllowed = rangesToCheck.some((range) => {
    const { start, end } = range;

    // Calculate whether the ip address is in the range, by converting the ip address to a number with ip2long.
    const inRange = ip2long(start) <= ip2long(userIp)
            && ip2long(end) >= ip2long(userIp);

    return inRange;
  });

  return isAllowed;
}

export { checkNetworkAccess };
