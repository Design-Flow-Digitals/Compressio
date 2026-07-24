import sharp from "sharp";

interface CompressOptions {
  quality?: number;
  format?: string;
  maxWidth?: number;
}

export async function compressImage(buffer: Buffer, options: CompressOptions = {}) {
  const quality = options.quality || 85;
  let pipeline = sharp(buffer);

  if (options.maxWidth) {
    pipeline = pipeline.resize({ width: options.maxWidth, withoutEnlargement: true });
  }

  const metadata = await pipeline.metadata();
  const formatToUse = options.format || metadata.format;

  if (formatToUse === "webp") {
    pipeline = pipeline.webp({ quality });
  } else if (formatToUse === "jpeg" || formatToUse === "jpg") {
    pipeline = pipeline.jpeg({ quality, mozjpeg: true });
  } else if (formatToUse === "png") {
    pipeline = pipeline.png({ quality });
  }

  const outputBuffer = await pipeline.toBuffer();
  return outputBuffer;
}
