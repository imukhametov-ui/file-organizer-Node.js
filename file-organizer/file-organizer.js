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

  case 'duplicates': {
  const dup = new DuplicateFinder();

  dup.on('scan-start', ({ directory }) => {
    console.log(`🔍 Searching for duplicates in: ${directory}`);
  });

  dup.on('file-processed', ({ current, total }) => {
    process.stdout.write(`\rCalculating hashes... ${current}/${total}`);
  });

  dup.on('duplicates-found', ({ duplicateGroups, totalWasted }) => {
    console.log('\n');

    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicates found.');
      return;
    }

    console.log(
      `Found ${duplicateGroups.length} duplicate group(s) (${(totalWasted / 1024).toFixed(2)} KB wasted):`
    );
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    duplicateGroups.forEach((group, index) => {
      console.log(`Group ${index + 1} (${group.files.length} copies, ${(group.fileSize / 1024).toFixed(2)} KB each):`);
      console.log(`SHA-256: ${group.hash}`);

      group.files.forEach(file => {
        console.log(`📄 ${file.path}`);
      });

      console.log(`Wasted space: ${(group.wasted / 1024).toFixed(2)} KB`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

    console.log(`💾 Total wasted space: ${(totalWasted / 1024).toFixed(2)} KB`);
  });

  await dup.find(targetPath);
  break;
}

  case 'organize': {
  const organizer = new Organizer();

  const outputIndex = process.argv.indexOf('--output');
  const outputDir =
    outputIndex !== -1 && process.argv[outputIndex + 1]
      ? process.argv[outputIndex + 1]
      : './organized-files';

  organizer.on('organize-start', ({ sourceDir, outputDir }) => {
    console.log(`📦 Organizing: ${sourceDir}`);
    console.log(`Target: ${outputDir}\n`);
    console.log('Creating folders...');
  });

  organizer.on('copy-start', () => {});

  organizer.on('copy-complete', ({ current, total }) => {
    process.stdout.write(`\rCopying files... ${current}/${total}`);
  });

  organizer.on('organize-complete', ({ summary, totalCopied, totalSize, outputDir }) => {
    console.log('\n\n✅ Organization complete!\n');
    console.log('Summary:');
    for (const [category, count] of Object.entries(summary)) {
      console.log(`${category}: ${count} files → ${outputDir}/${category}`);
    }
    console.log(`\nTotal copied: ${totalCopied} files (${(totalSize / 1024).toFixed(2)} KB)`);
  });

  await organizer.organize(targetPath, outputDir);
  break;
}

  case 'cleanup':
    const cleanup = new Cleanup();
    await cleanup.clean(targetPath);
    break;

  default:
    console.log('❌ Unknown command');
}