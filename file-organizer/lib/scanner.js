import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export default class Scanner extends EventEmitter {
  async scan(directory) {
    try {
      this.emit('scan-start', { directory });

      const files = await fs.readdir(directory);
      let totalFiles = 0;

      for (const file of files) {
        const fullPath = path.join(directory, file);
        const stats = await fs.stat(fullPath);

        if (stats.isFile()) {
          totalFiles++;
          this.emit('file-found', {
            path: fullPath,
            size: stats.size
          });
        }
      }

      this.emit('scan-complete', { totalFiles });

    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
}