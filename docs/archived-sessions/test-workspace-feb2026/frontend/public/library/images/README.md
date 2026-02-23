# Library Images Directory

This directory stores images for library documents.

## Usage

1. Place your images in this directory
2. Reference them in your markdown content using:
   - Relative path: `![alt text](/library/images/your-image.png)`
   - Or for external images: `![alt text](https://example.com/image.png)`

## Supported Formats

- PNG (.png)
- JPEG (.jpg, .jpeg)
- GIF (.gif)
- SVG (.svg)
- WebP (.webp)

## Organization

You can create subdirectories to organize images by document or category:

- `/library/images/technical/`
- `/library/images/guides/`
- `/library/images/references/`

## Notes

- Images are served statically from the public directory
- Maximum recommended size: 2MB per image
- Use descriptive filenames for better organization
