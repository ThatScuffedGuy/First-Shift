/** Formats game time as a wall clock, e.g. 0 seconds after an 18:00 start is "6:00 PM". */
export function formatClock(gameSeconds: number, startHour: number): string {
  const total = startHour * 3600 + Math.max(0, gameSeconds);
  const hours24 = Math.floor(total / 3600) % 24;
  const minutes = Math.floor(total / 60) % 60;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}
