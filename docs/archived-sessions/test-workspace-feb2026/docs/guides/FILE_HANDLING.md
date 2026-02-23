# File Upload & Media Management

**Status**: ✅ Production-ready (Concurrent uploads, progress tracking, validation)
**Last Updated**: November 10, 2025
**Audience**: Frontend & backend developers implementing file uploads

---

## Quick Navigation

### Upload Processor

- **Location**: `frontend/src/lib/upload/upload-processor.ts`
- **Purpose**: Concurrent multi-file upload processing with progress tracking
- **Features**:
  - Concurrent upload limiting (max 3 by default)
  - Progress callbacks
  - Status tracking (pending, validating, uploading, processing, success, error)
  - Error handling
  - Abort on demand

### File Validation

- **Location**: `frontend/src/lib/security/file-upload-validator.ts`
- **Purpose**: Validate uploaded files before submission
- **Features**:
  - File size validation
  - MIME type checking
  - Magic byte detection
  - Security checks

### Upload Logging

- **Location**: `frontend/src/lib/utils/upload-logger.ts`
- **Purpose**: Track and debug upload operations

---

## File Upload Architecture

### Upload Flow

```
User selects file(s)
    ↓
Frontend validation (size, type, magic bytes)
    ↓
File queued in store (referencesStore)
    ↓
Upload Processor begins
    ↓
Validate file
    ↓
Upload with progress tracking
    ↓
Processing status
    ↓
Success/Error callback
    ↓
Update UI with result
```

### Upload States

| State | Meaning | What to Show |
|-------|---------|--------------|
| `pending` | Waiting to upload | Queued indicator |
| `validating` | Checking file | Loading spinner |
| `uploading` | In progress | Progress bar |
| `processing` | Server processing | Processing spinner |
| `success` | Complete | Checkmark + result |
| `error` | Failed | Error message |

---

## How to Implement File Uploads

### Step 1: Import Required Components

```typescript
import { UploadProcessor } from '@/lib/upload/upload-processor';
import { validateFileUpload } from '@/lib/security/file-upload-validator';
import { useReferencesStore } from '@/lib/stores/referencesStore';
```

### Step 2: Create Upload Handler

```typescript
export function GalleryUploadForm({ projectSlug }) {
  const store = useReferencesStore();
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.currentTarget.files;
    if (!files) return;

    // Validate files
    for (const file of files) {
      const validation = await validateFileUpload(file, {
        maxSize: 5_000_000,        // 5 MB
        allowedMimes: ['image/jpeg', 'image/png'],
        checkMagicBytes: true
      });

      if (!validation.isValid) {
        alert(`File validation failed: ${validation.error}`);
        continue;
      }

      // Add to queue
      store.addFileToQueue(file, {
        tags: [],
        dateCreated: new Date()
      });
    }

    // Start uploading
    setUploading(true);
    await uploadFiles();
    setUploading(false);
  };

  const uploadFiles = async () => {
    const processor = new UploadProcessor(projectSlug, 3);

    await processor.processQueue(store.queue, {
      onProgress: (fileId, progress) => {
        store.updateFileProgress(fileId, progress);
      },
      onStatusChange: (fileId, status) => {
        store.updateFileStatus(fileId, status);
      },
      onSuccess: (fileId, imageId, filePath) => {
        store.markFileSuccess(fileId, imageId, filePath);
      },
      onError: (fileId, error) => {
        store.markFileError(fileId, error);
      }
    });
  };

  return (
    <div>
      <input
        type="file"
        multiple
        accept=".jpg,.png"
        onChange={handleFileSelect}
        disabled={uploading}
      />
      {uploading && <p>Uploading...</p>}
    </div>
  );
}
```

### Step 3: Display Upload Progress

```typescript
export function UploadQueueDisplay() {
  const store = useReferencesStore();

  return (
    <div className="space-y-4">
      {store.queue.map((queuedFile) => (
        <UploadQueueItem key={queuedFile.id} file={queuedFile} />
      ))}
    </div>
  );
}

function UploadQueueItem({ file }) {
  return (
    <div className="border rounded p-4">
      <h4>{file.file.name}</h4>

      {/* Status badge */}
      <Badge>{file.status}</Badge>

      {/* Progress bar for uploading state */}
      {file.status === 'uploading' && (
        <Progress value={file.progress} max={100} />
      )}

      {/* Error message */}
      {file.status === 'error' && (
        <Alert className="mt-2 text-red-600">{file.error}</Alert>
      )}

      {/* Success indicator */}
      {file.status === 'success' && (
        <CheckIcon className="text-green-600" />
      )}
    </div>
  );
}
```

---

## File Validation

### Validation Rules

**File Size**:
```typescript
// Max 5 MB
const maxSize = 5_000_000;

// Check
if (file.size > maxSize) {
  throw new Error('File too large');
}
```

**MIME Type**:
```typescript
// Allow only JPEG and PNG
const allowedMimes = ['image/jpeg', 'image/png'];

// Check
if (!allowedMimes.includes(file.type)) {
  throw new Error('Invalid file type');
}
```

**Magic Bytes** (File Signature):
```typescript
// Validate file signature to prevent disguised files
// JPEG: FF D8 FF
// PNG: 89 50 4E 47
// GIF: 47 49 46

const validateMagicBytes = async (file: File) => {
  const buffer = await file.slice(0, 4).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const jpegSignature = [0xFF, 0xD8, 0xFF];
  const pngSignature = [0x89, 0x50, 0x4E, 0x47];

  const isJpeg = jpegSignature.every((byte, i) => bytes[i] === byte);
  const isPng = pngSignature.every((byte, i) => bytes[i] === byte);

  return isJpeg || isPng;
};
```

### Validation Example

```typescript
const validation = await validateFileUpload(file, {
  maxSize: 5_000_000,
  allowedMimes: ['image/jpeg', 'image/png', 'image/gif'],
  checkMagicBytes: true
});

if (!validation.isValid) {
  console.error('Validation error:', validation.error);
  // Show error to user
} else {
  console.log('File is valid, safe to upload');
}
```

---

## Concurrent Upload Management

### How Concurrency Works

```typescript
// Max 3 concurrent uploads
const processor = new UploadProcessor(projectSlug, 3);

// Process queue respects the limit
await processor.processQueue(queue, callbacks);

// First 3 start immediately
// 4th waits for 1st to finish
// 5th waits for 2nd to finish
// etc.
```

### Why Limit Concurrency?

✅ **Browser limits**: Most browsers limit concurrent requests per domain
✅ **Server capacity**: Prevents overwhelming the server
✅ **Memory usage**: Reduces memory pressure from simultaneous uploads
✅ **Network efficiency**: Better use of available bandwidth

### Configuring Concurrency

```typescript
// Custom concurrency limit
const processor = new UploadProcessor(projectSlug, 5);

// For slow networks: lower limit
const processor = new UploadProcessor(projectSlug, 1);

// For fast networks: higher limit
const processor = new UploadProcessor(projectSlug, 5);
```

---

## Progress Tracking

### Progress Callback

```typescript
const processor = new UploadProcessor(projectSlug);

await processor.processQueue(queue, {
  onProgress: (fileId: string, progress: number) => {
    // progress = 0-100 percentage
    console.log(`File ${fileId}: ${progress}%`);
    updateProgressBar(progress);
  },

  onStatusChange: (fileId: string, status: UploadStatus) => {
    // status = 'pending' | 'validating' | 'uploading' | 'processing' | 'success' | 'error'
    console.log(`File ${fileId}: ${status}`);
  },

  onSuccess: (fileId: string, imageId: string, filePath: string) => {
    console.log(`File ${fileId} uploaded to ${filePath}`);
  },

  onError: (fileId: string, error: string) => {
    console.error(`File ${fileId} error: ${error}`);
  }
});
```

### UI Update Pattern

```typescript
function UploadProgressBar({ file }) {
  return (
    <div>
      {/* Filename */}
      <p>{file.file.name}</p>

      {/* Progress bar - only show while uploading */}
      {file.status === 'uploading' && (
        <div className="w-full bg-gray-200 rounded">
          <div
            className="bg-blue-600 h-2 rounded transition-all"
            style={{ width: `${file.progress}%` }}
          />
        </div>
      )}

      {/* Status text */}
      <p className="text-sm text-gray-600">
        {file.status === 'uploading' && `${file.progress}%`}
        {file.status === 'validating' && 'Validating...'}
        {file.status === 'processing' && 'Processing...'}
        {file.status === 'success' && '✓ Complete'}
        {file.status === 'error' && `✗ Error: ${file.error}`}
      </p>
    </div>
  );
}
```

---

## Error Handling

### Common Upload Errors

**File Too Large**:
```typescript
onError: (fileId, error) => {
  if (error.includes('too large')) {
    showError('File exceeds 5 MB limit');
  }
}
```

**Invalid File Type**:
```typescript
onError: (fileId, error) => {
  if (error.includes('Invalid MIME')) {
    showError('Only JPG and PNG files are allowed');
  }
}
```

**Network Error**:
```typescript
onError: (fileId, error) => {
  if (error.includes('network')) {
    showError('Upload failed - check your connection');
  }
}
```

**Server Error**:
```typescript
onError: (fileId, error) => {
  if (error.includes('500')) {
    showError('Server error - please try again later');
  }
}
```

### Retry Logic

```typescript
async function retryUpload(file: QueuedFile, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await uploadFile(file);
      if (result.success) return result;
    } catch (error) {
      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        await new Promise(resolve =>
          setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
        );
      } else {
        throw error;
      }
    }
  }
}
```

---

## Backend Upload Handler

### Example: Gallery Upload Route

```typescript
// app/api/projects/[slug]/references/route.ts
import { withSecurity } from '@/lib/security/middleware';
import { validateFileUpload } from '@/lib/security/file-upload-validator';
import { errorResponse, successResponse } from '@/lib/api/response';

export const POST = withSecurity(async (request, context) => {
  try {
    const params = await context.params;
    const projectSlug = params.slug;

    // Get form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return errorResponse('No file provided', 400);
    }

    // Validate file
    const validation = await validateFileUpload(file, {
      maxSize: 5_000_000,
      allowedMimes: ['image/jpeg', 'image/png'],
      checkMagicBytes: true
    });

    if (!validation.isValid) {
      return errorResponse(validation.error, 400);
    }

    // Save file
    const buffer = await file.arrayBuffer();
    const filename = `${Date.now()}-${file.name}`;
    const filepath = `/uploads/${projectSlug}/${filename}`;

    // Save to storage (disk, S3, etc.)
    await saveFile(filepath, buffer);

    // Return success
    return successResponse({
      imageId: generateId(),
      filePath: filepath,
      size: file.size,
      mimeType: file.type
    }, 201);
  } catch (error) {
    console.error('Upload error:', error);
    return errorResponse('Upload failed', 500);
  }
});
```

---

## File Constraints

### Application Limits

| Feature | Limit | Reason |
|---------|-------|--------|
| Max file size | 5 MB | Memory, storage |
| Max concurrent uploads | 3 | Browser, server limits |
| Max total upload time | 30s | Timeout handling |
| Allowed file types | JPG, PNG, GIF | Security, optimization |
| Max files per upload | Unlimited | Queue-based processing |

### Configurable by Feature

**Gallery uploads**: 5 MB, JPG/PNG only
**Document uploads**: 10 MB, PDF/DOC/DOCX
**Avatar uploads**: 2 MB, JPG/PNG only
**Video uploads**: 100 MB, MP4/WebM

---

## Security Considerations

### File Upload Security

✅ **Validate on server**: Never trust client-side validation alone
✅ **Check magic bytes**: Verify actual file type
✅ **Limit file size**: Prevent storage exhaustion
✅ **Sanitize filenames**: Remove special characters
✅ **Store safely**: Outside public web root if possible
✅ **Scan for malware**: Use antivirus scanning service (optional)

### Example: Secure Upload

```typescript
export const POST = withSecurity(async (request) => {
  // 1. Client-side validation (UX)
  // (handled by frontend before sending)

  // 2. Server-side validation (Security)
  const file = await getFile(request);

  // Check size (server-side)
  if (file.size > MAX_SIZE) {
    return errorResponse('File too large', 413);
  }

  // Check magic bytes (not just extension)
  const isValid = await validateMagicBytes(file);
  if (!isValid) {
    return errorResponse('Invalid file', 400);
  }

  // Sanitize filename
  const filename = sanitizeFilename(file.name);

  // Save to safe location
  const filepath = await saveFileSecurely(filename, file);

  return successResponse({ filepath }, 201);
});
```

---

## Performance Optimization

### Image Optimization

```typescript
async function optimizeImage(file: File) {
  // Compress image
  const canvas = await compressImage(file, {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.8
  });

  // Generate thumbnail
  const thumb = await generateThumbnail(canvas, 200, 200);

  return { optimized: canvas, thumbnail: thumb };
}
```

### Chunked Upload (for large files)

```typescript
async function uploadLargeFile(file: File, chunkSize = 1_000_000) {
  const chunks = Math.ceil(file.size / chunkSize);

  for (let i = 0; i < chunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);

    await uploadChunk(chunk, i, chunks);
    updateProgress((i + 1) / chunks * 100);
  }
}
```

---

## Testing File Uploads

### Unit Tests

```typescript
describe('File Upload Validator', () => {
  it('accepts valid JPEG', async () => {
    const file = createFile('test.jpg', 'image/jpeg', jpegBuffer);
    const result = await validateFileUpload(file);
    expect(result.isValid).toBe(true);
  });

  it('rejects oversized file', async () => {
    const file = createFile('test.jpg', 'image/jpeg', largeBuffer);
    const result = await validateFileUpload(file, { maxSize: 1_000_000 });
    expect(result.isValid).toBe(false);
  });

  it('rejects invalid MIME type', async () => {
    const file = createFile('test.exe', 'application/x-msdownload');
    const result = await validateFileUpload(file);
    expect(result.isValid).toBe(false);
  });
});
```

### Integration Tests

```typescript
describe('Upload Processor', () => {
  it('uploads multiple files with concurrency limit', async () => {
    const processor = new UploadProcessor('test-project', 2);
    const files = [file1, file2, file3, file4];

    let maxConcurrent = 0;
    let currentConcurrent = 0;

    await processor.processQueue(files, {
      onStatusChange: (id, status) => {
        if (status === 'uploading') {
          currentConcurrent++;
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        } else if (status === 'success' || status === 'error') {
          currentConcurrent--;
        }
      }
    });

    expect(maxConcurrent).toBe(2); // Respects limit
  });
});
```

---

## Related Documentation

- **[SECURITY_PATTERNS.md](./SECURITY_PATTERNS.md#4-input-validation)** - File validation patterns
- **[COMPONENTS.md](./COMPONENTS.md#fileinput)** - FileInput component
- **[docs/features/VIDEO_FEATURE_DOCUMENTATION.md](../features/VIDEO_FEATURE_DOCUMENTATION.md)** - Video upload specific guide
- **[docs/features/ALBUMS_FEATURE_DOCUMENTATION.md](../features/ALBUMS_FEATURE_DOCUMENTATION.md)** - Gallery/album feature

---

**Status**: ✅ Complete and current
**Last Updated**: November 10, 2025
