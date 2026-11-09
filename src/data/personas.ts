import type { Persona } from './types';

/**
 * Guest personalities. Each one changes which lines the guest says (see the
 * matching pools in the dialogue files), how patient they are, and whether
 * they ask for a recommendation.
 */
export const PERSONAS: Persona[] = [
  { kind: 'warm', label: 'Friendly', weight: 3, patience: 1.15, asksRecommendation: 0.4 },
  { kind: 'rushed', label: 'In a hurry', weight: 2, patience: 0.7, asksRecommendation: 0 },
  { kind: 'rude', label: 'Grumpy', weight: 2, patience: 0.85, asksRecommendation: 0.2 },
  { kind: 'indecisive', label: 'Indecisive', weight: 2, patience: 1.1, asksRecommendation: 1 },
  { kind: 'tourist', label: 'Tourist', weight: 1, patience: 1.2, asksRecommendation: 1 },
];
