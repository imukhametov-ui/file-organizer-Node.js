import Scanner from './lib/scanner.js';
import DuplicateFinder from './lib/duplicates.js';
import Organizer from './lib/organizer.js';
import Cleanup from './lib/cleanup.js';

const command = process.argv[2];
const targetPath = process.argv[3];

switch (command) {
  case 'scan':
    const scanner = new Scanner();
    scanner.on('scan-start', ({ directory }) => {
      console.log(`📂 Scanning: ${directory}`);
    });
    scanner.on('scan-complete', (data) => {
      console.log(`✅ Done. Files: ${data.totalFiles}`);
    });
    await scanner.scan(targetPath);
    break;

  case 'duplicates':
    const dup = new DuplicateFinder();
    await dup.find(targetPath);
    break;

  case 'organize':
    const organizer = new Organizer();
    await organizer.organize(targetPath);
    break;

  case 'cleanup':
    const cleanup = new Cleanup();
    await cleanup.clean(targetPath);
    break;

  default:
    console.log('❌ Unknown command');
}