/**
 * Recording script and checklist for voice lines.
 *
 *   npm run audio            -> writes audio-script/<lang>.md and .csv, and the manifest
 *   npm run audio -- --manifest   -> only refreshes the manifest (runs before dev and build)
 *
 * Put recordings in public/audio/<lang>/ named exactly as the checklist says,
 * e.g. public/audio/es/door.polite.1.guest.mp3 (mp3, m4a, ogg, wav or webm).
 * The game plays a recording when it exists and uses the device voice otherwise.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { recordableLines, type RecordableLine } from '../src/dialogue/expand';
import type { LanguagePack, NodeName } from '../src/dialogue/types';
import { NODES } from '../src/dialogue/types';
import type { Menu } from '../src/data/types';

const ROOT = join(import.meta.dirname, '..');
const LANG_DIR = join(ROOT, 'src/data/languages');
const AUDIO_DIR = join(ROOT, 'public/audio');
const OUT_DIR = join(ROOT, 'audio-script');
const MANIFEST = join(ROOT, 'src/data/audio-manifest.json');
const EXTENSIONS = ['.mp3', '.m4a', '.ogg', '.wav', '.webm'];

const packs: LanguagePack[] = readdirSync(LANG_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(LANG_DIR, f), 'utf8')));
const menu: Menu = JSON.parse(readFileSync(join(ROOT, 'src/data/menus/house.json'), 'utf8'));

/** Which clip IDs have a recording, and its file (relative to public/audio). */
function scanRecordings(): Record<string, string> {
  const clips: Record<string, string> = {};
  if (!existsSync(AUDIO_DIR)) return clips;
  for (const lang of readdirSync(AUDIO_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const file of readdirSync(join(AUDIO_DIR, lang.name))) {
      const ext = EXTENSIONS.find((e) => file.toLowerCase().endsWith(e));
      if (ext) clips[`${lang.name}/${file.slice(0, -ext.length)}`] = `${lang.name}/${file}`;
    }
  }
  return clips;
}

const clips = scanRecordings();
writeFileSync(MANIFEST, JSON.stringify({ clips }, null, 2) + '\n');
console.log(`Audio manifest: ${Object.keys(clips).length} recording(s) found.`);
if (process.argv.includes('--manifest')) process.exit(0);

const PERSONA_NOTES: Record<string, string> = {
  polite: 'Polite, everyday guest',
  warm: 'Warm and friendly guest',
  rushed: 'Guest in a hurry: quick, a bit tense',
  rude: 'Grumpy, sarcastic guest (never abusive)',
  indecisive: 'Indecisive guest: hesitant, lots of “um”',
  tourist: 'Tourist: slow, careful, unsure of the language',
  impatient: 'Guest who has waited too long: annoyed',
};

const speaker = (l: RecordableLine) => (l.role === 'reply' ? 'Waiter (Alex)' : PERSONA_NOTES[l.pool] ?? l.pool);
const fileName = (l: RecordableLine) => `${l.clipId.split('/')[1]}.mp3`;
const csv = (s: string) => `"${s.replace(/"/g, '""')}"`;

mkdirSync(OUT_DIR, { recursive: true });
for (const pack of packs) {
  const lines = recordableLines(pack, menu).sort((a, b) => NODES.indexOf(a.node) - NODES.indexOf(b.node) || a.clipId.localeCompare(b.clipId));
  const done = (l: RecordableLine) => l.clipId in clips;
  const fixed = lines.filter((l) => l.fixed);
  const filled = lines.filter((l) => !l.fixed);
  const count = (ls: RecordableLine[]) => `${ls.filter(done).length} of ${ls.length} recorded`;

  const table = (ls: RecordableLine[]) => {
    const byNode = new Map<NodeName, RecordableLine[]>();
    for (const l of ls) byNode.set(l.node, [...(byNode.get(l.node) ?? []), l]);
    return [...byNode]
      .map(([node, group]) =>
        [`### ${node}`, '', '| Done | File | Who | Line | English |', '| --- | --- | --- | --- | --- |', ...group.map((l) => `| ${done(l) ? '✅' : '☐'} | \`${fileName(l)}\` | ${speaker(l)} | ${l.text} | ${l.en} |`), ''].join('\n'),
      )
      .join('\n');
  };

  const md = `# ${pack.label} voice lines

Save recordings in \`public/audio/${pack.code}/\` using the file name in the table (mp3, m4a, ogg, wav or webm all work, just keep the name before the dot exactly the same). Then run \`npm run audio\` to tick them off here. Lines without a recording are read by the device's speech voice, so you can record as many or as few as you like.

**Part 1, fixed lines:** ${count(fixed)}. These never change, so one recording covers every shift. Start here.
**Part 2, lines with dish and drink names:** ${count(filled)}. One recording per menu combination. Optional: the device voice reads any you skip.

Speaker notes: "Waiter (Alex)" lines are your replies. Guest lines say which kind of guest is talking, so you can act the mood.

## Part 1: fixed lines

${table(fixed)}
## Part 2: lines with dish and drink names

${table(filled)}`;
  writeFileSync(join(OUT_DIR, `${pack.code}.md`), md);
  writeFileSync(
    join(OUT_DIR, `${pack.code}.csv`),
    ['done,file,speaker,step,line,english', ...lines.map((l) => [done(l) ? 'yes' : 'no', fileName(l), speaker(l), l.node, l.text, l.en].map((v) => csv(String(v))).join(','))].join('\n') + '\n',
  );
  console.log(`${pack.label}: fixed lines ${count(fixed)}; lines with names ${count(filled)}.`);
}
console.log(`Wrote recording checklists to audio-script/.`);
