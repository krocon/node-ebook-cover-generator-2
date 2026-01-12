import { ComicCoverGenerator } from './ComicCoverGenerator';
import { Options } from './types';
import * as path from 'path';
import * as fs from 'fs-extra';

let options: Options = {
  forceOverwrite: true,
  // sourceDir: process.env.SOURCE_DIR || 'd:/comics/_deu/y',
  sourceDir: process.env.SOURCE_DIR || 'C:/Users/kroco/WebstormProjects/node-ebook-cover-generator-2/test',
  outputDir: process.env.OUTPUT_DIR || null,
  errorFile: 'error.txt',
  outputs: [
    {nameExtension: "", dimension: [200, 300]},     // abc.cbr -> abc.jpg
    {nameExtension: "_xl", dimension: [800, 1200]}, // abc.cbr -> abc_xl.jpg
    // {nameExtension: "_o", dimension: null}          // abc.cbr -> abc_o.jpg, original size.
  ]
};

// If the user provided a specific path in the issue, let's keep it as an option but allow override for testing
if (process.argv[2]) {
    options.sourceDir = path.resolve(process.argv[2]);
}

async function main() {
    const generator = new ComicCoverGenerator(options);
    try {
        await generator.run();
    } catch (error: any) {
        // Fehler nur in die Error-Datei schreiben, damit die Konsolenausgabe (Progress) nicht gestört wird.
        try {
            const now = new Date().toISOString();
            const message = error?.message || String(error);
            const stack = error?.stack ? `\n${error.stack}` : '';
            const block = `\n\n[FATAL] ${now}\n${message}${stack}\n`;
            if (options.errorFile) {
                await fs.appendFile(options.errorFile, block, 'utf8');
            }
        } catch {
            // best-effort: keine Konsolenausgabe
        }
        process.exit(1);
    }
}

main();
