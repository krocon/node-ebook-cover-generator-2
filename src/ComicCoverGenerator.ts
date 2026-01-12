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

    console.log(`Found ${files.length} comic files.`);

    const concurrencyLimit = 4; // Or make it configurable
    const chunks: string[][] = [];
    for (let i = 0; i < files.length; i += concurrencyLimit) {
      chunks.push(files.slice(i, i + concurrencyLimit));
    }

    for (const chunk of chunks) {
      const results = await Promise.allSettled(chunk.map(file => this.processComic(file)));
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Error processing ${chunk[index]}:`, result.reason);
        }
      });
    }
  }

  private async processComic(comicPath: string): Promise<void> {
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
      // console.log(`Skipping ${comicPath} - all covers already exist.`);
      return;
    }

    console.log(`Processing ${comicPath}...`);

    // 1. Get archive content
    const files = await ArchiveHandler.getFiles(comicPath);
    
    // 2. Detect cover
    const coverFile = ArchiveHandler.getCoverFileName(files);
    if (!coverFile) {
      console.warn(`No cover found in ${comicPath}`);
      return;
    }
    console.log(`  Selected cover: ${coverFile}`);

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
  }
}
