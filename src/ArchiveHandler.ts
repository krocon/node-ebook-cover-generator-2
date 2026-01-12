import { path7za } from '7zip-bin';
import { spawn } from 'child_process';
import * as fs from 'fs-extra';
import { createExtractorFromData } from 'node-unrar-js';

export class ArchiveHandler {
  private static imgFilePattern = /\.(jpg|jpeg|png|webp)$/i;

  private static isRar(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.cbr');
  }

  public static async getFiles(archivePath: string): Promise<string[]> {
    if (this.isRar(archivePath)) {
      try {
        return await this.getRarFiles(archivePath);
      } catch (err) {
        // Fallback to 7z if RAR extraction fails (sometimes .cbr are actually ZIPs)
      }
    }
    return this.get7zFiles(archivePath);
  }

  private static async getRarFiles(archivePath: string): Promise<string[]> {
    const data = await fs.readFile(archivePath);
    const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const extractor = await createExtractorFromData({ data: arrayBuffer as ArrayBuffer });
    const list = extractor.getFileList();
    return Array.from(list.fileHeaders).map(h => h.name);
  }

  private static async get7zFiles(archivePath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const child = spawn(path7za, ['l', '-ba', '-slt', '-y', '-p-', archivePath]);
      let output = '';
      let stderr = '';

      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error(`7z list timed out after 30s for ${archivePath}`));
      }, 30000);
      
      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString().replace(/\r/g, '');
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          const msg = stderr ? stderr.trim() : `exit code ${code}`;
          return reject(new Error(`7z error: ${msg}`));
        }

        const files: string[] = [];
        const lines = output.split('\n');
        for (const line of lines) {
          if (line.startsWith('Path = ') && line.length > 7) {
            const filePath = line.substring(7).trim();
            // Ignore the archive path itself which is often the first entry in -slt output
            if (filePath !== archivePath && !filePath.endsWith('/') && !filePath.endsWith('\\')) {
                files.push(filePath);
            }
          }
        }
        resolve(files);
      });

      child.on('error', (err) => {
        reject(new Error(`7z execution failed: ${err.message}`));
      });
    });
  }

  public static async extractFileToBuffer(archivePath: string, fileName: string): Promise<Buffer> {
    if (this.isRar(archivePath)) {
      try {
        return await this.extractRarToBuffer(archivePath, fileName);
      } catch (err) {
        // Fallback to 7z
      }
    }
    return this.extract7zToBuffer(archivePath, fileName);
  }

  private static async extractRarToBuffer(archivePath: string, fileName: string): Promise<Buffer> {
    const data = await fs.readFile(archivePath);
    const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const extractor = await createExtractorFromData({ data: arrayBuffer as ArrayBuffer });
    const extracted = extractor.extract({ files: [fileName] });
    const files = Array.from(extracted.files);
    if (files.length === 0 || !files[0].extraction) {
      throw new Error(`File ${fileName} not found or extraction failed`);
    }
    return Buffer.from(files[0].extraction);
  }

  private static async extract7zToBuffer(archivePath: string, fileName: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // 'e' means extract, '-so' means write to stdout
      const child = spawn(path7za, ['e', '-y', '-p-', archivePath, fileName, '-so']);
      const chunks: Buffer[] = [];
      let stderr = '';

      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error(`7z extraction timed out after 30s for ${archivePath} (${fileName})`));
      }, 30000);

      child.stdout.on('data', (chunk) => {
        chunks.push(chunk);
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString().replace(/\r/g, '');
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          const msg = stderr ? stderr.trim() : `exit code ${code}`;
          return reject(new Error(`7z extraction error: ${msg}`));
        }
        resolve(Buffer.concat(chunks));
      });

      child.on('error', (err) => {
        reject(new Error(`7z extraction failed: ${err.message}`));
      });
    });
  }

  public static getCoverFileName(files: string[]): string | null {
    if (!files || files.length === 0) return null;

    const filteredFiles = files.filter(f => this.imgFilePattern.test(f));
    if (filteredFiles.length === 0) return null;

    const sorted = [...filteredFiles].sort((a, b) => this.compareEntries(a, b));
    return sorted[0];
  }

  private static compareEntries(a: string, b: string): number {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    
    const aIsCover = aLower.includes('cover.');
    const bIsCover = bLower.includes('cover.');

    if (aIsCover && !bIsCover) return -1;
    if (!aIsCover && bIsCover) return 1;

    const ca = this.getSeparatorCount(a);
    const cb = this.getSeparatorCount(b);
    
    if (ca !== cb) return ca - cb;

    return aLower.localeCompare(bLower);
  }

  private static getSeparatorCount(s: string): number {
    if (!s) return 0;
    let count = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '/' || s[i] === '\\') count++;
    }
    return count;
  }
}
