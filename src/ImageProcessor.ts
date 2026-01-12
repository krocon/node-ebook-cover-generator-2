import sharp from 'sharp';
import { OutputConfig } from './types';

export class ImageProcessor {
  public static async processImage(
    inputBuffer: Buffer,
    config: OutputConfig,
    outputPath: string
  ): Promise<void> {
    let pipeline = sharp(inputBuffer);

    if (config.dimension) {
      pipeline = pipeline.resize(config.dimension[0], config.dimension[1], {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    await pipeline
      .toFormat('jpeg', { quality: 80 })
      .toFile(outputPath);
  }
}
