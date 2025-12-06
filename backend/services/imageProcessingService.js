// backend/services/imageProcessingService.js
const sharp = require('sharp');

/**
 * Optimizes an image buffer for web use.
 * - Converts to WebP (Google's highly efficient format).
 * - Resizes to a maximum width maintaining aspect ratio (default 1920px for hero, configurable).
 * - Strips unnecessary metadata to reduce size.
 * 
 * @param {Buffer} fileBuffer - The raw image buffer from multer.
 * @param {Object} options - Configuration options.
 * @param {number} options.maxWidth - Max width in pixels (default 1920).
 * @param {number} options.quality - WebP quality (1-100, default 80).
 * @returns {Promise<{buffer: Buffer, info: sharp.OutputInfo}>} Optimized buffer and info.
 */
const optimizeImage = async (fileBuffer, options = {}) => {
    const maxWidth = options.maxWidth || 1920;
    const quality = options.quality || 80;

    try {
        console.log(`[ImageProcessing] Optimizing image: MaxWidth=${maxWidth}px, Quality=${quality}%...`);

        const pipeline = sharp(fileBuffer)
            .rotate() // Auto-rotate based on EXIF (crucial for mobile photos)
            .resize({
                width: maxWidth,
                withoutEnlargement: true, // Don't upscale small images
                fit: 'inside' // Maintain aspect ratio
            })
            .webp({
                quality: quality,
                effort: 4 // Balance between speed and compression (0-6)
            });

        const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

        console.log(`[ImageProcessing] Success! New size: ${(info.size / 1024).toFixed(2)} KB, Format: ${info.format}, Dims: ${info.width}x${info.height}`);
        return { buffer: data, info };
    } catch (error) {
        console.error("[ImageProcessing] Error optimizing image:", error);
        throw new Error("Error optimizando la imagen: " + error.message);
    }
};

module.exports = {
    optimizeImage
};
