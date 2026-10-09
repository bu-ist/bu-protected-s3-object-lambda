import { describe, it, expect } from 'vitest';
import { checkNetworkAccess } from './checkNetworkAccess.js';

const testRanges = {
  campus1: [
    { start: '10.0.0.0', end: '10.0.0.255', cidrs: [] },
    { start: '10.0.1.0', end: '10.0.1.255', cidrs: [] },
  ],
  campus2: [
    { start: '10.1.0.0', end: '10.1.0.255', cidrs: [] },
    { start: '10.1.1.0', end: '10.1.1.255', cidrs: [] },
  ],
};

describe('checkNetworkAccess', () => {
  // mod_shib sends Eppn on every request, an empty one indicates there is no login session.
  it('should return true if the user network IP address is in the first allowed range from campus1', () => {
    const headers = { Eppn: '', 'X-Real-Ip': '10.0.0.10' };
    const rules = { ranges: ['campus1'] };
    expect(checkNetworkAccess(rules, headers, testRanges)).toBe(true);
  });

  it('should return true if the user network IP address is in the second allowed range from campus1', () => {
    const headers = { Eppn: '', 'X-Real-Ip': '10.0.1.40' };
    const rules = { ranges: ['campus1'] };
    expect(checkNetworkAccess(rules, headers, testRanges)).toBe(true);
  });

  it('should return false if the user network IP address is not in the allowed ranges for campus1', () => {
    const headers = { Eppn: '', 'X-Real-Ip': '11.0.0.1' };
    const rules = { ranges: ['campus1'] };
    expect(checkNetworkAccess(rules, headers, testRanges)).toBe(false);
  });

  it('should return true if the user network IP address is in the allowed ranges for campus2', () => {
    const headers = { Eppn: '', 'X-Real-Ip': '10.1.0.5' };
    const rules = { ranges: ['campus1', 'campus2'] };
    expect(checkNetworkAccess(rules, headers, testRanges)).toBe(true);
  });

  it('should return false if the user network IP address is not in the allowed ranges for campus2', () => {
    const headers = { Eppn: '', 'X-Real-Ip': '11.0.30.30' };
    const rules = { ranges: ['campus2'] };
    expect(checkNetworkAccess(rules, headers, testRanges)).toBe(false);
  });

  // CloudFront edge SP tests. These requests have no Eppn header, and the edge sends the client
  // address it observed as X-Cf-Client-Ip.
  it('should use the edge address for an edge request', () => {
    const headers = { Authenticated: 'false', 'X-Cf-Client-Ip': '10.0.0.10' };
    const rules = { ranges: ['campus1'] };
    expect(checkNetworkAccess(rules, headers, testRanges)).toBe(true);
  });

  // On a mod_shib host the edge's header names could have been sent by the viewer, so the edge
  // address is ignored there and X-Real-Ip is used, as before.
  it('should ignore the edge address on a mod_shib request', () => {
    const headers = { Eppn: '', 'X-Cf-Client-Ip': '10.0.0.10', 'X-Real-Ip': '11.0.0.1' };
    const rules = { ranges: ['campus1'] };
    expect(checkNetworkAccess(rules, headers, testRanges)).toBe(false);
  });

  // Network ranges are IPv4. The edge percent-encodes its value, so an IPv6 address arrives with
  // %3A for each colon, and matches no range.
  it('should deny an IPv6 edge address', () => {
    const headers = {
      Authenticated: 'false',
      'X-Cf-Client-Ip': encodeURIComponent('2601:197:500:940:851f:f58d:8024:2a1e'),
    };
    const rules = { ranges: ['campus1'] };
    expect(checkNetworkAccess(rules, headers, testRanges)).toBe(false);
  });
});
