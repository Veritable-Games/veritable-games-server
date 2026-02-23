/**
 * Type declarations for exif-parser package
 * Since @types/exif-parser doesn't exist, we define minimal types based on usage
 */

declare module 'exif-parser' {
  interface ExifTags {
    DateTimeOriginal?: number;
    DateTime?: number;
    CreateDate?: number;
    [key: string]: any;
  }

  interface ExifResult {
    tags: ExifTags;
    imageSize?: {
      width: number;
      height: number;
    };
    thumbnailOffset?: number;
    thumbnailLength?: number;
    thumbnailType?: number;
    app1Offset?: number;
  }

  interface ExifParser {
    parse(): ExifResult;
    enableSimpleValues(enabled: boolean): ExifParser;
    enableTagNames(enabled: boolean): ExifParser;
    enableImageSize(enabled: boolean): ExifParser;
    enableReturnTags(enabled: boolean): ExifParser;
  }

  function create(buffer: Buffer): ExifParser;

  export default {
    create,
  };
}
