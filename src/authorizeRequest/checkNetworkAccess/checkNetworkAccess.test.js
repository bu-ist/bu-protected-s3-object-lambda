import { describe, it, expect } from 'vitest';
import { checkNetworkAccess } from './checkNetworkAccess';

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
  it('should return true if the user network IP address is in the first allowed range from campus1', () => {
    const headers = { 'X-Real-Ip': '10.0.0.10' };
    const rules = { ranges: ['campus1'] };
    expect(checkNetworkAccess(rules, headers, testRanges)).toBe(true);
  });

  it('should return true if the user network IP address is in the second allowed range from campus1', () => {
    const headers = { 'X-Real-Ip': '10.0.1.40' };
    const rules = { ranges: ['campus1'] };
    expect(checkNetworkAccess(rules, headers, testRanges)).toBe(true);
  });

  it('should return false if the user network IP address is not in the allowed ranges for campus1', () => {
    const headers = { 'X-Real-Ip': '11.0.0.1' };
    const rules = { ranges: ['campus1'] };
    expect(checkNetworkAccess(rules, headers, testRanges)).toBe(false);
  });

  it('should return true if the user network IP address is in the allowed ranges for campus2', () => {
    const headers = { 'X-Real-Ip': '10.1.0.5' };
    const rules = { ranges: ['campus1', 'campus2'] };
    expect(checkNetworkAccess(rules, headers, testRanges)).toBe(true);
  });

  it('should return false if the user network IP address is not in the allowed ranges for campus2', () => {
    const headers = { 'X-Real-Ip': '11.0.30.30' };
    const rules = { ranges: ['campus2'] };
    expect(checkNetworkAccess(rules, headers, testRanges)).toBe(false);
  });
});
