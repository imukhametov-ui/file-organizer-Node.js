import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export default class Scanner extends EventEmitter {
  async scan(directory) {
    try {
      this.emit('scan-start', { directory });

      const files = await fs.readdir(directory);
      
      let totalFiles = 0;
      let totalSize = 0;

      const fileTypes = {};
      const fileAges = {
        last7: 0,
        last30: 0,
        older90: 0
      };

      const allFiles = [];

      for (const file of files) {
        const fullPath = path.join(directory, file);
        const stats = await fs.stat(fullPath);

        if (stats.isFile()) {
          totalFiles++;
          totalSize += stats.size;

          const ext = path.extname(file) || 'no-ext';

          // типи файлів
          if (!fileTypes[ext]) {
            fileTypes[ext] = { count: 0, size: 0 };
          }
          fileTypes[ext].count++;
          fileTypes[ext].size += stats.size;

          // вік
          const daysOld = (Date.now() - stats.mtime) / (1000 * 60 * 60 * 24);

          if (daysOld <= 7) fileAges.last7++;
          else if (daysOld <= 30) fileAges.last30++;
          else if (daysOld > 90) fileAges.older90++;

          allFiles.push({
            name: file,
            size: stats.size,
            mtime: stats.mtime
          });
        }
      }

      // топ 3 великих
      const largest = [...allFiles]
        .sort((a, b) => b.size - a.size)
        .slice(0, 3);

      // найстаріший
      const oldest = [...allFiles]
        .sort((a, b) => a.mtime - b.mtime)[0];

      // ВИВІД
      console.log('\n📊 Scan Results');
      console.log('━━━━━━━━━━━━━━━━━━━━');

      console.log(`Total files: ${totalFiles}`);
      console.log(`Total size: ${(totalSize / 1024).toFixed(2)} KB\n`);

      console.log('By File Type:');
      for (const ext in fileTypes) {
        console.log(
          `${ext}: ${fileTypes[ext].count} files`
        );
      }

      console.log('\nFile Age:');
      console.log(`Last 7 days: ${fileAges.last7}`);
      console.log(`Last 30 days: ${fileAges.last30}`);
      console.log(`Older than 90 days: ${fileAges.older90}`);

      console.log('\nLargest files:');
      largest.forEach((f, i) => {
        console.log(`${i + 1}. ${f.name} (${(f.size / 1024).toFixed(2)} KB)`);
      });

      console.log(`\nOldest file: ${oldest?.name}`);

      this.emit('scan-complete', { totalFiles });

    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
}