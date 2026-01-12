import { path7za } from '7zip-bin';
import { spawn } from 'child_process';
import { quote } from 'shell-quote';

export class ArchiveHandler {
  private static imgFilePattern = /\.(jpg|jpeg|png|webp)$/i;

  public static async getFiles(archivePath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const child = spawn(path7za, ['l', '-ba', '-slt', archivePath]);
      let output = '';
      
      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`7z exited with code ${code}`));
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

      child.on('error', reject);
    });
  }

  public static async extractFileToBuffer(archivePath: string, fileName: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // 'e' means extract, '-so' means write to stdout
      const child = spawn(path7za, ['e', archivePath, fileName, '-so']);
      const chunks: Buffer[] = [];

      child.stdout.on('data', (chunk) => {
        chunks.push(chunk);
      });

      child.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`7z extraction exited with code ${code}`));
        }
        resolve(Buffer.concat(chunks));
      });

      child.on('error', reject);
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
