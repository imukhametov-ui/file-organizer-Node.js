import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function getAllFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      const nested = await getAllFiles(fullPath);
      files.push(...nested);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

export default class Cleanup extends EventEmitter {
  async clean(directory, days, confirm) {
    try {
      this.emit('cleanup-start', { directory, days });

      const allFiles = await getAllFiles(directory);
      const toDelete = [];

      for (const filePath of allFiles) {
        const stats = await fs.stat(filePath);

        const ageMs = Date.now() - stats.mtime.getTime();
        const daysOld = ageMs / (1000 * 60 * 60 * 24);

        if (daysOld > days) {
          toDelete.push({
            path: filePath,
            size: stats.size,
            daysOld: Math.floor(daysOld),
            mtime: stats.mtime,
          });

          this.emit('file-found', { filePath });
        }
      }

      this.emit('files-collected', { toDelete });

      if (!confirm) {
        this.emit('dry-run', { toDelete });
        return;
      }

      let deletedCount = 0;
      let freedSpace = 0;

      for (const file of toDelete) {
        await fs.unlink(file.path);
        deletedCount++;
        freedSpace += file.size;

        this.emit('file-deleted', {
          current: deletedCount,
          total: toDelete.length,
          filePath: file.path,
        });
      }

      this.emit('cleanup-complete', {
        deletedCount,
        freedSpace,
      });

    } catch (error) {
      if (error.code === 'ENOENT') {
        console.error(`❌ Error: Directory not found: ${directory}`);
      } else if (error.code === 'EACCES') {
        console.error(`❌ Error: Permission denied: ${directory}`);
      } else {
        console.error(`❌ Unexpected error: ${error.message}`);
      }
      process.exit(1);
    }
  }
}

export { formatSize };