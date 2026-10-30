import { describe, it, expect } from 'vitest';
import {
  isHlsUrl,
  isDirectVideoUrl,
  getVideoSourceType,
  extractYouTubeVideoId,
  extractVimeoId,
  isGoogleDriveUrl,
  getLessonHlsStreamUrl,
  getLessonMediaStreamUrl,
  isInternalGatewayUrl,
  isInternalLessonHls,
  hasActiveHlsMedia
} from './videoUtils';

describe('videoUtils - HLS Detection & Source Categorization', () => {
  describe('isHlsUrl - Strict .m3u8 Playlist Detection', () => {
    it('accepts standard legitimate .m3u8 playlist URLs', () => {
      expect(isHlsUrl('https://example.com/video/master.m3u8')).toBe(true);
      expect(isHlsUrl('https://r2.example.com/videos/user-1/master.m3u8')).toBe(true);
      expect(isHlsUrl('/uploads/hls/lesson-1/master.m3u8')).toBe(true);
      expect(isHlsUrl('https://cdn.example.com/hls/variant/index.m3u8')).toBe(true);
    });

    it('accepts .m3u8 URLs with query parameters (e.g., signed URLs)', () => {
      expect(isHlsUrl('https://example.com/video/master.m3u8?token=signed123&expires=1700000000')).toBe(true);
      expect(isHlsUrl('https://cdn.example.com/live/stream.m3u8?auth=xyz&bandwidth=max')).toBe(true);
      expect(isHlsUrl('/uploads/hls/playlist.m3u8?v=1.2.3')).toBe(true);
    });

    it('accepts .m3u8 URLs with URL fragments safely', () => {
      expect(isHlsUrl('https://example.com/video/master.m3u8#t=10')).toBe(true);
      expect(isHlsUrl('https://example.com/video/master.m3u8?token=xyz#segment-1')).toBe(true);
      expect(isHlsUrl('/stream/master.m3u8#frag')).toBe(true);
    });

    it('accepts mixed-case .m3u8 extensions', () => {
      expect(isHlsUrl('https://example.com/video/master.M3U8')).toBe(true);
      expect(isHlsUrl('https://example.com/video/master.m3U8?token=abc')).toBe(true);
      expect(isHlsUrl('https://example.com/video/master.M3u8#intro')).toBe(true);
    });

    it('rejects MP4/WebM URLs even if their directory contains /hls/', () => {
      expect(isHlsUrl('/hls/lesson.mp4')).toBe(false);
      expect(isHlsUrl('https://cdn.example.com/hls/lesson.mp4')).toBe(false);
      expect(isHlsUrl('https://example.com/hls/stream.webm')).toBe(false);
      expect(isHlsUrl('https://cdn.example.com/hls/archive.zip')).toBe(false);
      expect(isHlsUrl('https://cdn.example.com/path/hls/video.mp4?sig=123')).toBe(false);
    });

    it('rejects URLs that merely contain .m3u8 in an unrelated path or filename suffix', () => {
      expect(isHlsUrl('video.m3u8.mp4')).toBe(false);
      expect(isHlsUrl('https://example.com/video.m3u8.mp4')).toBe(false);
      expect(isHlsUrl('https://example.com/video.m3u8.mp4?token=123')).toBe(false);
      expect(isHlsUrl('https://example.com/video.m3u8.mp4#frag')).toBe(false);
      expect(isHlsUrl('https://example.com/.m3u8/video.mp4')).toBe(false);
      expect(isHlsUrl('https://example.com/hls.m3u8.backup/stream.mp4')).toBe(false);
      expect(isHlsUrl('https://example.com/master.m3u8/segment1.ts')).toBe(false);
    });

    it('correctly rejects non-HLS URLs, empty strings, and nullish inputs', () => {
      // Google Drive
      expect(isHlsUrl('https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OGvE2upms/view')).toBe(false);
      expect(isHlsUrl('https://docs.google.com/uc?id=1234567890abcdef')).toBe(false);

      // YouTube
      expect(isHlsUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false);
      expect(isHlsUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(false);

      // Vimeo
      expect(isHlsUrl('https://vimeo.com/123456789')).toBe(false);

      // Direct MP4 / WebM / Local uploads
      expect(isHlsUrl('https://storage.supabase.co/v1/object/public/videos/lesson.mp4')).toBe(false);
      expect(isHlsUrl('/uploads/lesson-sample.mp4')).toBe(false);
      expect(isHlsUrl('https://example.com/video.webm')).toBe(false);
      expect(isHlsUrl('')).toBe(false);
      expect(isHlsUrl('   ')).toBe(false);
      expect(isHlsUrl(null)).toBe(false);
      expect(isHlsUrl(undefined)).toBe(false);
    });
  });

  describe('Source categorization & legacy compatibility', () => {
    it('preserves existing source types for all legacy and external videos', () => {
      // Google Drive
      expect(getVideoSourceType('https://drive.google.com/file/d/1234567890/view')).toBe('google-drive');
      expect(isGoogleDriveUrl('https://drive.google.com/file/d/1234567890/view')).toBe(true);

      // YouTube
      expect(getVideoSourceType('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube');
      expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');

      // Vimeo
      expect(getVideoSourceType('https://vimeo.com/123456789')).toBe('vimeo');
      expect(extractVimeoId('https://vimeo.com/123456789')).toBe('123456789');

      // Direct MP4
      expect(getVideoSourceType('https://example.com/lecture.mp4')).toBe('direct');
      expect(isDirectVideoUrl('https://example.com/lecture.mp4')).toBe(true);

      // Direct HLS (.m3u8) is recognized as direct playable media
      expect(getVideoSourceType('https://example.com/master.m3u8')).toBe('direct');
      expect(isDirectVideoUrl('https://example.com/master.m3u8')).toBe(true);
    });
  });

  describe('HLS Manifest Level Sorting & Deterministic Deduplication', () => {
    // Pure reproduction of the manifest mapping & deduplication algorithm in UnifiedVideoPlayer.tsx
    function mapHlsLevels(rawLevels: Array<{ height?: any; width?: any; bitrate?: any }>) {
      const levels: Array<{ id: number; label: string; height?: number }> = [
        { id: -1, label: 'تلقائي (Auto)' }
      ];

      const seenHeights = new Set<number>();
      const mappedLevels: Array<{ id: number; label: string; height: number; bitrate: number }> = [];

      rawLevels.forEach((lvl: any, index: number) => {
        const parsedHeight = typeof lvl.height === 'number' && !isNaN(lvl.height) && lvl.height > 0
          ? lvl.height
          : typeof lvl.width === 'number' && !isNaN(lvl.width) && lvl.width > 0
          ? Math.round(lvl.width * 9 / 16)
          : 0;
        const parsedBitrate = typeof lvl.bitrate === 'number' && !isNaN(lvl.bitrate) && lvl.bitrate > 0
          ? lvl.bitrate
          : 0;

        if (parsedHeight > 0) {
          mappedLevels.push({
            id: index,
            height: parsedHeight,
            bitrate: parsedBitrate,
            label: parsedHeight >= 1080 ? '1080p HD' : parsedHeight >= 720 ? '720p HD' : parsedHeight >= 480 ? '480p' : parsedHeight >= 360 ? '360p' : `${parsedHeight}p`
          });
        }
      });

      // Primary sort: descending height. Secondary sort: descending bitrate (highest bitrate retained).
      mappedLevels.sort((a, b) => {
        const heightDiff = b.height - a.height;
        if (heightDiff !== 0) return heightDiff;
        return b.bitrate - a.bitrate;
      });

      for (const item of mappedLevels) {
        if (!seenHeights.has(item.height)) {
          seenHeights.add(item.height);
          levels.push({ id: item.id, label: item.label, height: item.height });
        }
      }

      return levels;
    }

    it('correctly maps manifest levels to sorted labels without hardcoding 1080p', () => {
      // Case 1: Manifest with 360p, 480p, 720p only (NO 1080p)
      const levelsCase1 = mapHlsLevels([
        { height: 360, bitrate: 600000 },
        { height: 480, bitrate: 1200000 },
        { height: 720, bitrate: 2500000 }
      ]);

      expect(levelsCase1.map(l => l.label)).toEqual([
        'تلقائي (Auto)',
        '720p HD',
        '480p',
        '360p'
      ]);
      expect(levelsCase1.some(l => l.label.includes('1080p'))).toBe(false);

      // Case 2: Manifest with 360p, 480p, 720p, 1080p
      const levelsCase2 = mapHlsLevels([
        { height: 360, bitrate: 600000 },
        { height: 480, bitrate: 1200000 },
        { height: 720, bitrate: 2500000 },
        { height: 1080, bitrate: 4500000 }
      ]);

      expect(levelsCase2.map(l => l.label)).toEqual([
        'تلقائي (Auto)',
        '1080p HD',
        '720p HD',
        '480p',
        '360p'
      ]);
    });

    it('deterministically selects the highest bitrate rendition when duplicate heights exist', () => {
      const rawLevels = [
        { height: 720, bitrate: 1500000 }, // index 0 (lower bitrate 720p)
        { height: 720, bitrate: 2800000 }, // index 1 (highest bitrate 720p)
        { height: 720, bitrate: 2000000 }, // index 2 (mid bitrate 720p)
        { height: 480, bitrate: 800000 },  // index 3 (lower bitrate 480p)
        { height: 480, bitrate: 1200000 }, // index 4 (highest bitrate 480p)
        { height: 360, bitrate: 500000 }   // index 5
      ];

      const levels = mapHlsLevels(rawLevels);

      // Expected order: Auto, 720p HD, 480p, 360p
      expect(levels.map(l => l.label)).toEqual([
        'تلقائي (Auto)',
        '720p HD',
        '480p',
        '360p'
      ]);

      // Retained 720p level should be index 1 (bitrate 2800000)
      const level720 = levels.find(l => l.height === 720);
      expect(level720?.id).toBe(1);

      // Retained 480p level should be index 4 (bitrate 1200000)
      const level480 = levels.find(l => l.height === 480);
      expect(level480?.id).toBe(4);

      // Retained 360p level should be index 5
      const level360 = levels.find(l => l.height === 360);
      expect(level360?.id).toBe(5);
    });

    it('safely handles missing or invalid height/width/bitrate metadata', () => {
      const rawLevels = [
        { height: null, width: null, bitrate: null }, // totally invalid -> ignored
        { height: 0, width: 0, bitrate: 0 },          // zeroes -> ignored
        { height: -100, bitrate: -500 },              // negative -> ignored
        { width: 1280, bitrate: 2000000 },            // height missing, calculated from 1280*9/16 = 720
        { height: 720, bitrate: undefined },          // same height, missing bitrate (treated as 0)
        { height: 360, bitrate: NaN }                 // NaN bitrate handled safely
      ];

      const levels = mapHlsLevels(rawLevels);

      expect(levels.map(l => l.label)).toEqual([
        'تلقائي (Auto)',
        '720p HD',
        '360p'
      ]);

      // The 720p rendition with valid bitrate 2000000 (index 3) should beat the one with undefined bitrate (index 4)
      const level720 = levels.find(l => l.height === 720);
      expect(level720?.id).toBe(3);

      const level360 = levels.find(l => l.height === 360);
      expect(level360?.id).toBe(5);
    });
  });

  describe('HLS Gateway URL Construction and Origin Security', () => {
    it('constructs clean master playlist URL for HLS.js without query token', () => {
      const url = getLessonHlsStreamUrl('lesson-123');
      expect(url).toBe('/api/courses/lessons/lesson-123/hls/master.m3u8');
      expect(url.includes('token')).toBe(false);
      expect(url.includes('?')).toBe(false);
    });

    it('constructs Safari native HLS fallback URL with scoped video ticket query parameter', () => {
      const ticket = 'scoped-video-ticket-xyz';
      const url = getLessonHlsStreamUrl('lesson-123', ticket);
      expect(url).toBe('/api/courses/lessons/lesson-123/hls/master.m3u8?token=scoped-video-ticket-xyz');
      expect(url.includes('token=scoped-video-ticket-xyz')).toBe(true);
    });

    it('identifies internal gateway URLs and relative paths for header attachment', () => {
      // Relative paths (subresources like variant playlists and segments)
      expect(isInternalGatewayUrl('master.m3u8')).toBe(true);
      expect(isInternalGatewayUrl('360p/playlist.m3u8')).toBe(true);
      expect(isInternalGatewayUrl('720p/segment_001.ts')).toBe(true);
      expect(isInternalGatewayUrl('segment_000.ts')).toBe(true);
      expect(isInternalGatewayUrl('/api/courses/lessons/123/hls/master.m3u8')).toBe(true);
      expect(isInternalGatewayUrl('/api/courses/lessons/123/hls/720p/playlist.m3u8')).toBe(true);
      expect(isInternalGatewayUrl('/api/courses/lessons/123/stream')).toBe(true);
      expect(isInternalGatewayUrl('http://localhost/api/courses/lessons/123/hls/master.m3u8')).toBe(true);
      expect(isInternalGatewayUrl('http://localhost:4004/api/courses/lessons/123/hls/master.m3u8')).toBe(true);
    });

    it('strictly rejects protocol-relative and external absolute URLs from receiving Authorization headers', () => {
      // Protocol-relative URLs
      expect(isInternalGatewayUrl('//evil.example/segment.ts')).toBe(false);
      expect(isInternalGatewayUrl('//attacker.com/hls/master.m3u8')).toBe(false);
      expect(isInternalGatewayUrl('//localhost:4004/api/courses/lessons/123/hls/master.m3u8')).toBe(false);

      // External absolute URLs
      expect(isInternalGatewayUrl('https://evil.example/segment.ts')).toBe(false);
      expect(isInternalGatewayUrl('https://untrusted-cdn.com/videos/stream.m3u8')).toBe(false);
      expect(isInternalGatewayUrl('https://malicious-site.example/steal/segment.ts')).toBe(false);
      expect(isInternalGatewayUrl('http://third-party.com/video.ts')).toBe(false);
      expect(isInternalGatewayUrl('https://attacker.com/api/courses/lessons/123/hls/master.m3u8')).toBe(false);
      expect(isInternalGatewayUrl('https://trusted.example.evil.test/api/courses/lessons/123/hls/master.m3u8')).toBe(false);

      // Unconfigured localhost ports
      expect(isInternalGatewayUrl('http://localhost:8888/api/courses/lessons/123/hls/master.m3u8')).toBe(false);
      expect(isInternalGatewayUrl('http://127.0.0.1:9999/api/courses/lessons/123/hls/master.m3u8')).toBe(false);
      expect(isInternalGatewayUrl('http://localhost:4001/api/courses/lessons/123/hls/master.m3u8')).toBe(false);
    });

    it('strictly rejects unexpected schemes, malformed URLs, and nullish inputs', () => {
      expect(isInternalGatewayUrl('javascript:alert(1)')).toBe(false);
      expect(isInternalGatewayUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isInternalGatewayUrl('file:///etc/passwd')).toBe(false);
      expect(isInternalGatewayUrl('ftp://example.com/segment.ts')).toBe(false);
      expect(isInternalGatewayUrl('blob:http://localhost/uuid-123')).toBe(false);
      expect(isInternalGatewayUrl('http://')).toBe(false);
      expect(isInternalGatewayUrl('http://:80')).toBe(false);
      expect(isInternalGatewayUrl('master\0.m3u8')).toBe(false);
      expect(isInternalGatewayUrl('\\\\evil.example\\segment.ts')).toBe(false);
      expect(isInternalGatewayUrl('')).toBe(false);
      expect(isInternalGatewayUrl('   ')).toBe(false);
      expect(isInternalGatewayUrl(null as any)).toBe(false);
      expect(isInternalGatewayUrl(undefined as any)).toBe(false);
    });

    it('strictly rejects same-origin but unrelated API paths and unanchored path prefixes', () => {
      // Unrelated endpoints
      expect(isInternalGatewayUrl('/api/users/profile')).toBe(false);
      expect(isInternalGatewayUrl('/api/admin/settings')).toBe(false);
      expect(isInternalGatewayUrl('/api/auth/login')).toBe(false);
      expect(isInternalGatewayUrl('/api/courses/overview')).toBe(false);
      expect(isInternalGatewayUrl('/api/courses/lessons/123/exams')).toBe(false);
      expect(isInternalGatewayUrl('http://localhost/api/users/me')).toBe(false);
      expect(isInternalGatewayUrl('http://localhost/api/admin/system')).toBe(false);

      // Unanchored or incorrect path prefixes
      expect(isInternalGatewayUrl('/unexpected/lessons/123/hls/master.m3u8')).toBe(false);
      expect(isInternalGatewayUrl('/api/users/lessons/123/hls/master.m3u8')).toBe(false);
      expect(isInternalGatewayUrl('/api/admin/lessons/123/hls/master.m3u8')).toBe(false);
      expect(isInternalGatewayUrl('http://localhost/unexpected/lessons/123/hls/master.m3u8')).toBe(false);
      expect(isInternalGatewayUrl('http://localhost/api/users/lessons/123/hls/master.m3u8')).toBe(false);
    });

    it('strictly rejects normalized and encoded path traversal attempts', () => {
      // Normalized path traversal escaping the gateway route
      expect(isInternalGatewayUrl('../../../../etc/passwd')).toBe(false);
      expect(isInternalGatewayUrl('../../../../api/admin/users')).toBe(false);
      expect(isInternalGatewayUrl('../../../api/users')).toBe(false);
      expect(isInternalGatewayUrl('/api/courses/lessons/123/hls/../../admin/secret')).toBe(false);
      expect(isInternalGatewayUrl('/api/courses/lessons/123/hls/../../../etc/passwd')).toBe(false);

      // Percent-encoded traversal attempts (%2e%2e)
      expect(isInternalGatewayUrl('%2e%2e')).toBe(false);
      expect(isInternalGatewayUrl('%2e%2e/segment.ts')).toBe(false);
      expect(isInternalGatewayUrl('/api/courses/lessons/123/hls/%2e%2e/%2e%2e/admin/secret')).toBe(false);
      expect(isInternalGatewayUrl('/api/courses/lessons/123/hls/%2e%2e/admin')).toBe(false);
      expect(isInternalGatewayUrl('/api/courses/lessons/%2e%2e/admin')).toBe(false);
    });

    it('correctly categorizes internal lesson HLS references', () => {
      // R2 direct key
      expect(isInternalLessonHls('videos/upload-1/attempts/1/hls/master.m3u8')).toBe(true);
      // Gateway relative path
      expect(isInternalLessonHls('/api/courses/lessons/123/hls/master.m3u8')).toBe(true);
      // Upload UUID
      expect(isInternalLessonHls('12345678-1234-1234-1234-123456789abc')).toBe(true);
      // upload: prefix
      expect(isInternalLessonHls('upload:my-upload-id')).toBe(true);

      // Non-internal / external sources
      expect(isInternalLessonHls('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false);
      expect(isInternalLessonHls('https://drive.google.com/file/d/123/view')).toBe(false);
      expect(isInternalLessonHls('https://vimeo.com/123456')).toBe(false);
      expect(isInternalLessonHls('/uploads/videos/lecture.mp4')).toBe(false);
      expect(isInternalLessonHls(null)).toBe(false);
      expect(isInternalLessonHls('')).toBe(false);
    });
  });

  describe('hasActiveHlsMedia & Resolver Precedence', () => {
    const driveUrl = 'https://drive.google.com/file/d/1GpUrvzEoEshP6ExyC4ced8nAdEtF1_G-/view';

    it('returns true when lesson has hasActiveHls explicit flag set by backend', () => {
      const lesson = {
        videoUrl: driveUrl,
        activeMediaId: 'media-1',
        hasActiveHls: true
      };
      expect(hasActiveHlsMedia(lesson)).toBe(true);
    });

    it('returns true when lesson has completed activeMedia matching canonical Google Drive source', () => {
      const lesson = {
        videoUrl: driveUrl,
        activeMediaId: 'media-1',
        activeMedia: {
          id: 'media-1',
          status: 'COMPLETED',
          canonicalSource: 'gdrive:1GpUrvzEoEshP6ExyC4ced8nAdEtF1_G-',
          masterPlaylistKey: 'videos/media-1/attempts/token-1/hls/master.m3u8'
        }
      };
      expect(hasActiveHlsMedia(lesson)).toBe(true);
    });

    it('returns false when activeMedia is still in-flight (PENDING, DOWNLOADING, TRANSCODING)', () => {
      const pendingLesson = {
        videoUrl: driveUrl,
        activeMediaId: 'media-1',
        activeMedia: {
          id: 'media-1',
          status: 'DOWNLOADING',
          canonicalSource: 'gdrive:1GpUrvzEoEshP6ExyC4ced8nAdEtF1_G-',
          masterPlaylistKey: null
        }
      };
      expect(hasActiveHlsMedia(pendingLesson)).toBe(false);
    });

    it('returns false when activeMedia source differs from current lesson.videoUrl (reverted/altered source)', () => {
      const alteredLesson = {
        videoUrl: 'https://drive.google.com/file/d/different-drive-file-id/view',
        activeMediaId: 'media-1',
        activeMedia: {
          id: 'media-1',
          status: 'COMPLETED',
          canonicalSource: 'gdrive:1GpUrvzEoEshP6ExyC4ced8nAdEtF1_G-',
          masterPlaylistKey: 'videos/media-1/attempts/token-1/hls/master.m3u8'
        }
      };
      expect(hasActiveHlsMedia(alteredLesson)).toBe(false);
    });

    it('returns false for external YouTube video even if stale activeMedia exists', () => {
      const ytLesson = {
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        activeMediaId: 'media-1',
        activeMedia: {
          id: 'media-1',
          status: 'COMPLETED',
          canonicalSource: 'gdrive:1GpUrvzEoEshP6ExyC4ced8nAdEtF1_G-',
          masterPlaylistKey: 'videos/media-1/attempts/token-1/hls/master.m3u8'
        }
      };
      expect(hasActiveHlsMedia(ytLesson)).toBe(false);
    });

    it('returns false when activeMediaId is null or lesson is null/empty', () => {
      expect(hasActiveHlsMedia({ videoUrl: driveUrl, activeMediaId: null })).toBe(false);
      expect(hasActiveHlsMedia(null)).toBe(false);
      expect(hasActiveHlsMedia(undefined)).toBe(false);
    });

    it('verifies resolver precedence: HLS route is selected when active HLS is ready, progressive stream when not', () => {
      const resolveUrl = (lesson: any, lessonId: string, videoTicket?: string) => {
        const videoSourceType = getVideoSourceType(lesson?.videoUrl);
        const isDirectHls = isInternalLessonHls(lesson?.videoUrl);
        const isLessonHlsActive = hasActiveHlsMedia(lesson);
        const isInternalHls = isDirectHls || isLessonHlsActive;

        return isInternalHls
          ? getLessonHlsStreamUrl(lessonId)
          : videoSourceType === 'google-drive'
          ? getLessonMediaStreamUrl(lessonId, videoTicket)
          : lesson?.videoUrl;
      };

      // 1. Google Drive video with completed active HLS -> selects /hls/master.m3u8
      const completedHlsLesson = {
        videoUrl: driveUrl,
        activeMediaId: 'media-1',
        hasActiveHls: true
      };
      expect(resolveUrl(completedHlsLesson, 'lesson-100')).toBe('/api/courses/lessons/lesson-100/hls/master.m3u8');

      // 2. Google Drive video with pending HLS -> falls back to progressive /stream
      const pendingHlsLesson = {
        videoUrl: driveUrl,
        activeMediaId: 'media-1',
        hasActiveHls: false
      };
      expect(resolveUrl(pendingHlsLesson, 'lesson-100', 'ticket-123')).toBe('/api/courses/lessons/lesson-100/stream?token=ticket-123');

      // 3. YouTube video -> directly returns YouTube URL without touching HLS or /stream
      const ytLesson = {
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        activeMediaId: null,
        hasActiveHls: false
      };
      expect(resolveUrl(ytLesson, 'lesson-100')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });
  });
});


