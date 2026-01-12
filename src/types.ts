export interface OutputConfig {
  nameExtension: string;
  dimension: [number, number] | null;
}

export interface Options {
  forceOverwrite: boolean;
  sourceDir: string;
  outputDir: string | null;
  outputs: OutputConfig[];
  errorFile?: string;
}
