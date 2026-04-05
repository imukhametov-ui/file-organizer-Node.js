import { EventEmitter } from 'events';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function getAllFiles(directory) {
  const entries = await fsp.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      const nestedFiles = await getAllFiles(fullPath);
      files.push(...nestedFiles);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function calculateHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export default class DuplicateFinder extends EventEmitter {
  async find(directory) {
    try {
      this.emit('scan-start', { directory });

      const allFiles = await getAllFiles(directory);
      const hashMap = new Map();

      let processed = 0;

      for (const filePath of allFiles) {
        const stats = await fsp.stat(filePath);
        const hash = await calculateHash(filePath);

        if (!hashMap.has(hash)) {
          hashMap.set(hash, []);
        }

        hashMap.get(hash).push({
          path: filePath,
          size: stats.size
        });

        processed++;
        this.emit('file-processed', {
          current: processed,
          total: allFiles.length,
          filePath
        });
      }

      const duplicateGroups = [];
      let totalWasted = 0;

      for (const [hash, files] of hashMap.entries()) {
        if (files.length > 1) {
          const fileSize = files[0].size;
          const wasted = fileSize * (files.length - 1);
          totalWasted += wasted;

          duplicateGroups.push({
            hash,
            files,
            wasted,
            fileSize
          });
        }
      }

      this.emit('duplicates-found', {
        totalFiles: allFiles.length,
        duplicateGroups,
        totalWasted
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