import * as fs from 'fs-extra';
import * as path from 'path';
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
      
      if (processed % 5 === 0 || processed === totalFiles) {
        const percent = ((processed / totalFiles) * 100).toFixed(1);
        const progressLine = `Fortschritt: ${processed}/${totalFiles} (${percent}%) | Zeit: ${formatTime(elapsed)} | Verbleibend: ${formatTime(estimatedRemaining)} | Übersprungen: ${skippedCount}`;
        process.stdout.write(`\r${progressLine}${' '.repeat(Math.max(0, 80 - progressLine.length))}`);
      }
    };

    const concurrencyLimit = 4; // Or make it configurable
    for (let i = 0; i < files.length; i += concurrencyLimit) {
      const chunk = files.slice(i, i + concurrencyLimit);
      const results = await Promise.allSettled(chunk.map(file => this.processComic(file)));
      
      results.forEach((result, index) => {
        processed++;
        if (result.status === 'rejected') {
          console.error(`\nError processing ${chunk[index]}:`, result.reason);
        } else if ((result as any).value === 'skipped') {
          skippedCount++;
        }
        updateProgress();
      });
    }
    console.log('\nDone.');
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
