# node-ebook-cover-generator-2

A Node.js tool to automatically extract and process covers from comic book archives (CBR, CBZ, CB7, etc.). It searches through a directory, finds comic files, extracts the first image, and generates one or more JPEG versions based on your configuration.

## Features

- **Supports multiple formats**: CBR (RAR), CBZ (ZIP), CB7 (7Z).
- **Recursive scanning**: Finds comics in subdirectories.
- **Multiple outputs**: Generate different sizes (e.g., thumbnail, XL, original) in one pass.
- **Efficient**: Skips already processed files unless forced to overwrite.
- **Smart detection**: Automatically identifies the cover image within the archive.

## Installation

```bash
npm install
```

The project uses `sharp` for image processing and `7zip-bin` for archive extraction.

## Usage

### Simple Start

You can run the generator using the predefined script:

```bash
npm start
```

By default, it uses the configuration defined in `src/index.ts`. You can also provide a source directory as an argument:

```bash
npm start -- /path/to/your/comics
```

### Integration

```typescript
import { ComicCoverGenerator } from './src/ComicCoverGenerator';
import { Options } from './src/types';

const options: Options = {
  forceOverwrite: false,
  sourceDir: './comics',
  outputDir: './covers',
  outputs: [
    { nameExtension: "_thumb", dimension: [200, 300] },
    { nameExtension: "_large", dimension: [800, 1200] },
    { nameExtension: "_orig", dimension: null }
  ]
};

const generator = new ComicCoverGenerator(options);
generator.run().then(() => console.log('Done!'));
```

## Configuration (The `options` Object)

The `ComicCoverGenerator` constructor takes an `Options` object. Below is the detailed documentation for all available settings.

### `Options` Interface

| Property | Type | Description |
| :--- | :--- | :--- |
| `sourceDir` | `string` | **Required.** The root directory where the tool will search for comic files. |
| `outputDir` | `string \| null` | The directory where the generated covers will be saved. If `null`, covers will be saved in the same directory as the source comic file. |
| `forceOverwrite` | `boolean` | If `true`, existing cover images will be re-generated. If `false`, the tool skips files where all configured outputs already exist. |
| `outputs` | `OutputConfig[]` | An array of configurations defining what images should be generated for each comic. |
| `errorFile` | `string` | (Optional) Path to a text file where errors and skipped files will be logged. |

### `OutputConfig` Interface

Defines the specifications for a single output image.

| Property | Type | Description |
| :--- | :--- | :--- |
| `nameExtension` | `string` | A suffix added to the original filename (e.g., `comic_thumb.jpg`). Use an empty string `""` for no suffix. |
| `dimension` | `[number, number] \| null` | The target dimensions `[width, height]` in pixels. If `null`, the original image dimensions are preserved. |

## Development

- `npm run build`: Compile TypeScript to JavaScript.
- `npm run start`: Run the generator directly via `ts-node`.
- `npm test`: Create test data and run the generator.

## License

Created by [Marc Kronberg](https://krocon.de).
