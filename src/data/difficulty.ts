/** Difficulty levels and shift lengths, chosen on the shift setup screen. */
export interface Difficulty {
  id: 'easy' | 'normal' | 'hard';
  label: string;
  description: string;
  /** Multiplies every patience limit. */
  patience: number;
  /** Multiplies the gap between arrivals (above 1 = guests come slower). */
  arrivalGap: number;
  /** Chance of an accident per trip with a tray. */
  accidentChance: number;
  /** Real seconds to react to an accident. */
  reactSeconds: number;
  /** Wrong options shown next to the right one. */
  wrongOptions: number;
  /** Whether the ticket shows each dish's allergens. */
  ticketAllergens: boolean;
}

export const DIFFICULTIES: Difficulty[] = [
  { id: 'easy', label: 'Relaxed', description: 'Patient guests, fewer accidents, more time to react.', patience: 1.35, arrivalGap: 1.25, accidentChance: 0.2, reactSeconds: 2.3, wrongOptions: 2, ticketAllergens: true },
  { id: 'normal', label: 'Normal', description: 'A regular dinner shift.', patience: 1, arrivalGap: 1, accidentChance: 0.35, reactSeconds: 1.7, wrongOptions: 2, ticketAllergens: true },
  { id: 'hard', label: 'Busy night', description: 'Impatient guests, more accidents, four options per line, and no allergen hints on the ticket.', patience: 0.8, arrivalGap: 0.85, accidentChance: 0.5, reactSeconds: 1.3, wrongOptions: 3, ticketAllergens: false },
];

export interface ShiftLength {
  id: 'short' | 'dinner' | 'full';
  label: string;
  guests: number;
}

export const SHIFT_LENGTHS: ShiftLength[] = [
  { id: 'short', label: 'Quick shift (5 guests)', guests: 5 },
  { id: 'dinner', label: 'Dinner rush (8 guests)', guests: 8 },
  { id: 'full', label: 'Full evening (12 guests)', guests: 12 },
];

export const difficultyById = (id: string) => DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
export const lengthById = (id: string) => SHIFT_LENGTHS.find((l) => l.id === id) ?? SHIFT_LENGTHS[0];
