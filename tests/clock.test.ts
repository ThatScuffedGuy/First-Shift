import { describe, expect, it } from 'vitest';
import { formatClock } from '../src/game/clock';

describe('formatClock', () => {
  it('starts the shift at 6:00 PM', () => {
    expect(formatClock(0, 18)).toBe('6:00 PM');
  });
  it('counts game minutes', () => {
    expect(formatClock(15 * 60 + 59, 18)).toBe('6:15 PM');
  });
  it('rolls past midnight', () => {
    expect(formatClock(6 * 3600 + 5 * 60, 18)).toBe('12:05 AM');
  });
});
