/**
 * Video Player Comparison Test Page
 *
 * Side-by-side comparison of Plyr vs HTML5 native video players
 * Use this page to test both players and decide which to use in production
 *
 * Access at: http://localhost:3000/test-video-players
 *
 * Test with sample video data to compare:
 * - UI/UX and controls
 * - Accessibility features
 * - Performance
 * - Bundle size impact
 */

'use client';

import { VideoCardPlyr } from '@/components/references/VideoCardPlyr';
import { VideoCardHTML5 } from '@/components/references/VideoCardHTML5';
import type { ReferenceImage } from '@/types/project-references';
import type { ProjectId, UserId, ReferenceImageId } from '@/lib/database/schema-types';

export default function VideoPlayerTestPage() {
  // Sample video data for testing
  // Replace with actual video URLs from your uploads
  const sampleVideo: ReferenceImage = {
    id: 1 as ReferenceImageId,
    project_id: 1 as ProjectId,
    filename_storage: 'sample_video.mp4',
    file_path: '/uploads/videos/sample-project/video_1234567890.mp4',
    file_size: 10485760, // 10MB
    mime_type: 'video/mp4',
    width: 1280,
    height: 720,
    aspect_ratio: 16 / 9,
    duration: 60, // 1 minute
    poster_path: '/uploads/videos/sample-project/thumbs/video_1234567890_thumb.jpg',
    sort_order: 0,
    tags: [],
    uploader: {
      id: 1 as UserId,
      username: 'admin',
      display_name: 'Admin User',
    },
    is_deleted: false,
    deleted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-4 text-4xl font-bold">Video Player Comparison</h1>
          <p className="max-w-3xl text-gray-400">
            Side-by-side comparison of Plyr (accessible, beautiful UI) vs HTML5 native video player
            (zero dependencies). Test both to decide which fits your needs.
          </p>
        </div>

        {/* Comparison Grid */}
        <div className="mb-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Plyr Player */}
          <div>
            <div className="mb-4">
              <h2 className="mb-2 text-2xl font-semibold">Plyr Player</h2>
              <div className="space-y-1 text-sm text-gray-400">
                <p>✅ Beautiful, consistent UI across browsers</p>
                <p>✅ WCAG compliant accessibility</p>
                <p>✅ Keyboard navigation (Space, arrows, M, F)</p>
                <p>✅ Picture-in-Picture support</p>
                <p>✅ Speed controls (0.5x - 2x)</p>
                <p>⚠️ Additional dependency (30KB gzipped)</p>
              </div>
            </div>
            <div className="rounded-lg bg-gray-800 p-4">
              <VideoCardPlyr video={sampleVideo} isAdmin={false} />
            </div>
          </div>

          {/* HTML5 Player */}
          <div>
            <div className="mb-4">
              <h2 className="mb-2 text-2xl font-semibold">HTML5 Native Player</h2>
              <div className="space-y-1 text-sm text-gray-400">
                <p>✅ Zero dependencies</p>
                <p>✅ Extremely lightweight</p>
                <p>✅ Works everywhere</p>
                <p>⚠️ Inconsistent UI across browsers</p>
                <p>⚠️ Less accessible than Plyr</p>
                <p>⚠️ Limited customization</p>
              </div>
            </div>
            <div className="rounded-lg bg-gray-800 p-4">
              <VideoCardHTML5 video={sampleVideo} isAdmin={false} />
            </div>
          </div>
        </div>

        {/* Feature Comparison Table */}
        <div className="mb-12">
          <h2 className="mb-4 text-2xl font-semibold">Feature Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="px-4 py-3">Feature</th>
                  <th className="px-4 py-3">Plyr</th>
                  <th className="px-4 py-3">HTML5</th>
                </tr>
              </thead>
              <tbody className="text-gray-400">
                <tr className="border-b border-gray-800">
                  <td className="px-4 py-3">Bundle Size</td>
                  <td className="px-4 py-3">30KB gzipped</td>
                  <td className="px-4 py-3 text-green-400">0 KB (built-in)</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="px-4 py-3">UI Consistency</td>
                  <td className="px-4 py-3 text-green-400">Identical across browsers</td>
                  <td className="px-4 py-3 text-yellow-400">Varies by browser</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="px-4 py-3">Accessibility</td>
                  <td className="px-4 py-3 text-green-400">WCAG compliant</td>
                  <td className="px-4 py-3 text-yellow-400">Basic support</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="px-4 py-3">Keyboard Controls</td>
                  <td className="px-4 py-3 text-green-400">Full support</td>
                  <td className="px-4 py-3 text-yellow-400">Limited</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="px-4 py-3">Speed Controls</td>
                  <td className="px-4 py-3 text-green-400">0.5x - 2x</td>
                  <td className="px-4 py-3 text-red-400">Not built-in</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="px-4 py-3">Picture-in-Picture</td>
                  <td className="px-4 py-3 text-green-400">Yes</td>
                  <td className="px-4 py-3 text-yellow-400">Browser dependent</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="px-4 py-3">Customization</td>
                  <td className="px-4 py-3 text-green-400">Extensive</td>
                  <td className="px-4 py-3 text-red-400">Limited</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Dependencies</td>
                  <td className="px-4 py-3 text-yellow-400">plyr-react</td>
                  <td className="px-4 py-3 text-green-400">None</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Recommendations */}
        <div className="rounded-lg bg-gray-800 p-6">
          <h2 className="mb-4 text-2xl font-semibold">Recommendations</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-lg font-medium text-green-400">Use Plyr if:</h3>
              <ul className="space-y-2 text-gray-400">
                <li>• You need consistent UI across all browsers</li>
                <li>• Accessibility is a priority</li>
                <li>• You want advanced features (speed control, PiP)</li>
                <li>• 30KB extra bundle size is acceptable</li>
                <li>• You value professional, polished appearance</li>
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-lg font-medium text-blue-400">Use HTML5 if:</h3>
              <ul className="space-y-2 text-gray-400">
                <li>• Minimal bundle size is critical</li>
                <li>• You want zero dependencies</li>
                <li>• Browser-native controls are acceptable</li>
                <li>• Basic video playback is sufficient</li>
                <li>• You trust browser vendors to improve controls</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Installation Instructions */}
        <div className="mt-8 rounded-lg bg-gray-800 p-6">
          <h2 className="mb-4 text-2xl font-semibold">Installation</h2>
          <p className="mb-4 text-gray-400">
            To use Plyr in production, you need to install the plyr-react package:
          </p>
          <div className="rounded bg-gray-900 p-4 font-mono text-sm">
            <code className="text-green-400">npm install plyr-react</code>
          </div>
          <p className="mt-4 text-gray-400">
            HTML5 native player requires no installation - it&apos;s built into the browser.
          </p>
        </div>

        {/* Testing Instructions */}
        <div className="mt-8 rounded-lg border border-blue-800 bg-blue-900/20 p-6">
          <h2 className="mb-3 text-xl font-semibold">Testing Instructions</h2>
          <ol className="list-inside list-decimal space-y-2 text-gray-300">
            <li>Upload a test video to your project gallery</li>
            <li>Replace the sample video URLs in this page with your uploaded video</li>
            <li>Test both players with your actual video content</li>
            <li>Compare playback quality, controls, and user experience</li>
            <li>Test on different browsers (Chrome, Firefox, Safari)</li>
            <li>Test keyboard controls (Space, arrows, M for mute, F for fullscreen)</li>
            <li>Test on mobile devices</li>
            <li>Make your decision based on your specific needs</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
