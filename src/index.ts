import { ComicCoverGenerator } from './ComicCoverGenerator';
import { Options } from './types';
import * as path from 'path';

let options: Options = {
  forceOverwrite: true,
  sourceDir: '/Users/marckronberg/comics.nosync',
  // sourceDir: process.env.SOURCE_DIR || path.join(__dirname, '../test-comics'),
  outputDir: process.env.OUTPUT_DIR || null,
  outputs: [
    {nameExtension: "", dimension: [200, 300]},     // abc.cbr -> abc.jpg
    {nameExtension: "_xl", dimension: [800, 1200]}, // abc.cbr -> abc_xl.jpg
    {nameExtension: "_o", dimension: null}          // abc.cbr -> abc_o.jpg, original size.
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
        console.log('Finished processing comics.');
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

main();
