/**
 * Free downloadable voices (Piper, open source) for languages whose device
 * voice is missing or poor. Downloaded once into the browser, then they work
 * offline. Keyed by language code; the size is shown before downloading.
 */
export const NEURAL_VOICES: Record<string, { voiceId: string; sizeMb: number }> = {
  ru: { voiceId: 'ru_RU-irina-medium', sizeMb: 63 },
  es: { voiceId: 'es_ES-davefx-medium', sizeMb: 63 },
  fr: { voiceId: 'fr_FR-siwis-medium', sizeMb: 63 },
};
