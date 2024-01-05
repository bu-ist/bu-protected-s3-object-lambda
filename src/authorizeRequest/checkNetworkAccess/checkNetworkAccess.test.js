import { describe, it, expect } from 'vitest';
import { checkNetworkAccess } from './checkNetworkAccess';

describe('checkNetworkAccess', () => {
  it('should return true if the user network IP address is in the allowed ranges from the crc vpn segment', () => {
    const headers = { 'X-Real-Ip': '168.122.75.89' };
    const rules = { ranges: ['crc'] };
    expect(checkNetworkAccess(rules, headers)).toBe(true);
  });

  it('should return true if the user network IP address is in the allowed ranges from the crc campus', () => {
    const headers = { 'X-Real-Ip': '128.197.30.30' };
    const rules = { ranges: ['crc'] };
    expect(checkNetworkAccess(rules, headers)).toBe(true);
  });

  it('should return false if the user network IP address is not in the allowed ranges from the crc campus', () => {
    const headers = { 'X-Real-Ip': '128.100.0.1' };
    const rules = { ranges: ['crc'] };
    expect(checkNetworkAccess(rules, headers)).toBe(false);
  });

  it('should return true if the user network IP address is in the allowed ranges from the medical campus', () => {
    const headers = { 'X-Real-Ip': '155.41.140.5' };
    const rules = { ranges: ['crc', 'mc'] };
    expect(checkNetworkAccess(rules, headers)).toBe(true);
  });

  it('should return false if the user network IP address is not in the allowed ranges from the medical campus', () => {
    const headers = { 'X-Real-Ip': '128.197.30.30' };
    const rules = { ranges: ['mc'] };
    expect(checkNetworkAccess(rules, headers)).toBe(false);
  });
});
