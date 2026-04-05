import { EventEmitter } from 'events';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';

const CATEGORIES = {
  Documents: ['.pdf', '.doc', '.docx', '.txt', '.md', '.xlsx', '.pptx'],
  Images: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.gpg'],
  Archives: ['.zip', '.rar', '.tar', '.gz', '.7z'],
  Code: ['.js', '.mjs', '.cjs', '.py', '.java', '.cpp', '.html', '.css', '.json'],
  Videos: ['.mp4', '.avi', '.mkv', '.mov', '.webm'],
  Other: [],
};

function getCategory(fileName) {
  const ext = path.extname(fileName).toLowerCase();

  for (const [category, extensions] of Object.entries(CATEGORIES)) {
    if (extensions.includes(ext)) {
      return category;
    }
  }

  return 'Other';
}

async function getAllFiles(directory) {
  const entries = await fsp.readdir(directory, { withFileTypes: true });
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

async function ensureCategoryFolders(outputDir) {
  for (const category of Object.keys(CATEGORIES)) {
    await fsp.mkdir(path.join(outputDir, category), { recursive: true });
  }
}

async function getUniqueTargetPath(targetPath) {
  const dir = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const base = path.basename(targetPath, ext);

  let counter = 1;
  let candidate = targetPath;

  while (true) {
    try {
      await fsp.access(candidate);
      candidate = path.join(dir, `${base}(${counter})${ext}`);
      counter++;
    } catch {
      return candidate;
    }
  }
}

async function copyFileSmart(sourcePath, targetPath, size) {
  const TEN_MB = 10 * 1024 * 1024;

  if (size >= TEN_MB) {
    await pipeline(
      fs.createReadStream(sourcePath),
      fs.createWriteStream(targetPath)
    );
  } else {
    await fsp.copyFile(sourcePath, targetPath);
  }
}

export default class Organizer extends EventEmitter {
  async organize(sourceDir, outputDir) {
    try {
      this.emit('organize-start', { sourceDir, outputDir });

      const allFiles = await getAllFiles(sourceDir);
      await ensureCategoryFolders(outputDir);

      const summary = {
        Documents: 0,
        Images: 0,
        Archives: 0,
        Code: 0,
        Videos: 0,
        Other: 0,
      };

      let totalCopied = 0;
      let totalSize = 0;

      for (const filePath of allFiles) {
        const stats = await fsp.stat(filePath);
        const fileName = path.basename(filePath);
        const category = getCategory(fileName);

        const initialTargetPath = path.join(outputDir, category, fileName);
        const finalTargetPath = await getUniqueTargetPath(initialTargetPath);

        this.emit('copy-start', {
          sourcePath: filePath,
          targetPath: finalTargetPath,
        });

        await copyFileSmart(filePath, finalTargetPath, stats.size);

        summary[category]++;
        totalCopied++;
        totalSize += stats.size;

        this.emit('copy-complete', {
          sourcePath: filePath,
          targetPath: finalTargetPath,
          current: totalCopied,
          total: allFiles.length,
        });
      }

      this.emit('organize-complete', {
        summary,
        totalCopied,
        totalSize,
        outputDir,
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.error(`❌ Error: Directory not found: ${sourceDir}`);
      } else if (error.code === 'EACCES') {
        console.error(`❌ Error: Permission denied: ${sourceDir}`);
      } else {
        console.error(`❌ Unexpected error: ${error.message}`);
      }
      process.exit(1);
    }
  }
}