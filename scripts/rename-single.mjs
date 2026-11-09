// Gives the single-file build a friendly name.
import { renameSync } from 'node:fs';
renameSync('play/index.html', 'play/First-Shift.html');
