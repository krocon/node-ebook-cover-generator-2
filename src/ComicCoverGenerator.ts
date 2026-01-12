import * as fs from 'fs-extra';
import * as path from 'path';
import * as readline from 'readline';
import { glob } from 'glob';
import { Options, OutputConfig } from './types';
import { ArchiveHandler } from './ArchiveHandler';
import { ImageProcessor } from './ImageProcessor';

export class ComicCoverGenerator {
  constructor(private options: Options) {}

  public async run(): Promise<void> {
    const { sourceDir } = this.options;
    
    // Find all .cb* files
    const pattern = path.join(sourceDir, '**/*.cb{r,z,7,t,a}').replace(/\\/g, '/');
    const files = await glob(pattern);
    const totalFiles = files.length;

    console.log(`Found ${totalFiles} comic files.`);

    const startTime = Date.now();
    let processed = 0;
    let skippedCount = 0;
    let lastErrorWriteCount = 0;
    const errors: {file: string, error: any}[] = [];

    const formatTime = (ms: number): string => {
      const seconds = Math.floor(ms / 1000);
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
    };

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const estimatedTotal = processed > 0 ? (elapsed / processed) * totalFiles : 0;
      const estimatedRemaining = estimatedTotal > 0 ? Math.max(0, estimatedTotal - elapsed) : 0;
      
      // Update at every 5th file, or every file if we have few files, or at the very end
      if (processed % 5 === 0 || processed === totalFiles || totalFiles < 100) {
        const percent = ((processed / totalFiles) * 100).toFixed(1);
        const progressLine = `[${percent}%] ${processed}/${totalFiles} | Zeit: ${formatTime(elapsed)} | Verbleibend: ${formatTime(estimatedRemaining)} | Fehler: ${errors.length} | Übersprungen: ${skippedCount}`;
        
        if (process.stdout.isTTY) {
          readline.clearLine(process.stdout, 0);
          readline.cursorTo(process.stdout, 0);
          process.stdout.write(progressLine);
        } else {
          // Fallback for non-TTY environments: only print every 10% to avoid flooding
          if (processed % Math.max(1, Math.floor(totalFiles / 10)) === 0 || processed === totalFiles) {
             process.stdout.write(`\n${progressLine}`);
          }
        }
      }
    };

    const concurrencyLimit = 4; // Or make it configurable
    for (let i = 0; i < files.length; i += concurrencyLimit) {
      const chunk = files.slice(i, i + concurrencyLimit);
      const results = await Promise.allSettled(chunk.map(file => this.processComic(file)));
      
      results.forEach((result, index) => {
        try {
          processed++;
          if (result.status === 'rejected') {
            errors.push({ file: chunk[index], error: result.reason });
            const errorMsg = (result.reason instanceof Error ? result.reason.message : String(result.reason)).trim();
            const displayMsg = errorMsg.split('\n')[0].trim();
            
            if (process.stdout.isTTY) {
              readline.clearLine(process.stdout, 0);
              readline.cursorTo(process.stdout, 0);
            } else {
              process.stdout.write('\n');
            }
            console.log(`Fehler bei ${chunk[index]}:\n  ${displayMsg}`);
          } else if ((result as any).value === 'skipped') {
            skippedCount++;
          }
          updateProgress();
        } catch (e) {
          if (process.stdout.isTTY) {
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);
          }
          console.error(`Unerwarteter Fehler bei der Ergebnisverarbeitung: ${e}`);
        }
      });

      // Write error file approximately every 10 files if errors exist
      if (processed >= lastErrorWriteCount + 10) {
        await this.writeErrorFile(errors);
        lastErrorWriteCount = processed;
      }
    }
    
    if (errors.length > 0) {
      console.log(`\n\nAbgeschlossen mit ${errors.length} ${errors.length === 1 ? 'Fehler' : 'Fehlern'}.`);
      const displayLimit = 10;
      if (errors.length <= displayLimit) {
        errors.forEach(e => {
          const msg = e.error.message || String(e.error);
          console.log(`- ${e.file}:\n  ${msg.replace(/\n/g, '\n  ')}`);
        });
      } else {
        console.log(`Die ersten ${displayLimit} Fehler:`);
        errors.slice(0, displayLimit).forEach(e => {
          const msg = e.error.message || String(e.error);
          console.log(`- ${e.file}:\n  ${msg.replace(/\n/g, '\n  ')}`);
        });
        console.log(`... und ${errors.length - displayLimit} weitere Fehler. Siehe ${this.options.errorFile} für Details.`);
      }

      await this.writeErrorFile(errors);
    }
    console.log('\nFertig.');
  }

  private async writeErrorFile(errors: {file: string, error: any}[]): Promise<void> {
    try {
      if (this.options.errorFile && errors.length > 0) {
        const errorLog = errors.map(e => {
          const msg = (e.error.message || String(e.error)).replace(/\r?\n/g, ' | ');
          return `${e.file}: ${msg}`;
        }).join('\n');
        await fs.writeFile(this.options.errorFile, errorLog, 'utf8');
      }
    } catch (err) {
      console.error(`\nFailed to write error file: ${err}`);
    }
  }

  private async processComic(comicPath: string): Promise<'processed' | 'skipped'> {
    const { sourceDir, outputDir, forceOverwrite, outputs } = this.options;
    
    // Determine base output path
    const relativePath = path.relative(sourceDir, comicPath);
    const comicDir = path.dirname(relativePath);
    const comicName = path.basename(comicPath, path.extname(comicPath));
    
    const targetBaseDir = outputDir 
      ? path.join(outputDir, comicDir)
      : path.join(sourceDir, comicDir);

    // Check if all output files already exist
    const pendingOutputs = outputs.filter(out => {
      const outName = `${comicName}${out.nameExtension}.jpg`;
      const outPath = path.join(targetBaseDir, outName);
      return forceOverwrite || !fs.existsSync(outPath);
    });

    if (pendingOutputs.length === 0) {
      return 'skipped';
    }

    // 1. Get archive content
    const files = await ArchiveHandler.getFiles(comicPath);
    
    // 2. Detect cover
    const coverFile = ArchiveHandler.getCoverFileName(files);
    if (!coverFile) {
      // console.warn(`No cover found in ${comicPath}`);
      return 'skipped';
    }

    // 3. Extract cover to buffer
    const coverBuffer = await ArchiveHandler.extractFileToBuffer(comicPath, coverFile);

    // 4. Ensure target directory exists
    await fs.ensureDir(targetBaseDir);

    // 5. Generate outputs
    for (const outConfig of pendingOutputs) {
      const outName = `${comicName}${outConfig.nameExtension}.jpg`;
      const outPath = path.join(targetBaseDir, outName);
      
      await ImageProcessor.processImage(coverBuffer, outConfig, outPath);
    }

    return 'processed';
  }
}
