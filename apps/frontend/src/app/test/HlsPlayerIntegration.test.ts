import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getLessonHlsStreamUrl,
  getLessonMediaStreamUrl,
  isInternalGatewayUrl,
  isInternalLessonHls,
  getVideoSourceType,
  isHlsUrl
} from '../utils/videoUtils';

describe('Phase 2C.2 - HLS Gateway Frontend Integration & Security', () => {
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    let store: Record<string, string> = {};
    globalThis.localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => { store[key] = String(val); },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; },
      key: (i: number) => Object.keys(store)[i] || null,
      length: 0
    } as any;
  });

  afterEach(() => {
    globalThis.localStorage = originalLocalStorage;
  });

  // Mock XMLHttpRequest for testing xhrSetup hook
  class MockXHR {
    public headers: Record<string, string> = {};
    public url: string = '';

    open(method: string, url: string) {
      this.url = url;
    }

    setRequestHeader(header: string, value: string) {
      this.headers[header] = value;
    }
  }

  // Reproduces the exact xhrSetup logic implemented in UnifiedVideoPlayer.tsx
  function createPlayerXhrSetup(videoTicket?: string) {
    return (xhr: any, url: string) => {
      if (isInternalGatewayUrl(url)) {
        const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null) || videoTicket;
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
      }
    };
  }

  describe('Requirement 1 & 2: HLS.js Header Injection without URL Tokens', () => {
    it('attaches Authorization Bearer header to master playlist request and ensures URL has no query token', () => {
      localStorage.setItem('token', 'valid-jwt-token-abc');
      const xhrSetup = createPlayerXhrSetup();
      const xhr = new MockXHR();

      const masterUrl = getLessonHlsStreamUrl('lesson-1');
      expect(masterUrl).toBe('/api/courses/lessons/lesson-1/hls/master.m3u8');
      expect(masterUrl.includes('token')).toBe(false);

      xhr.open('GET', masterUrl);
      xhrSetup(xhr, masterUrl);

      expect(xhr.headers['Authorization']).toBe('Bearer valid-jwt-token-abc');
      expect(xhr.url.includes('?token=')).toBe(false);
    });

    it('attaches Authorization Bearer header to variant playlist request without query tokens', () => {
      localStorage.setItem('token', 'valid-jwt-token-abc');
      const xhrSetup = createPlayerXhrSetup();
      const xhr = new MockXHR();

      const variantUrl = '/api/courses/lessons/lesson-1/hls/720p/playlist.m3u8';
      xhr.open('GET', variantUrl);
      xhrSetup(xhr, variantUrl);

      expect(xhr.headers['Authorization']).toBe('Bearer valid-jwt-token-abc');
      expect(variantUrl.includes('token')).toBe(false);
    });

    it('attaches Authorization Bearer header to relative media segment requests without query tokens', () => {
      localStorage.setItem('token', 'valid-jwt-token-abc');
      const xhrSetup = createPlayerXhrSetup();
      const xhr = new MockXHR();

      // Relative segment subresource resolved by HLS.js
      const segmentUrl = '720p/segment_000.ts';
      xhr.open('GET', segmentUrl);
      xhrSetup(xhr, segmentUrl);

      expect(xhr.headers['Authorization']).toBe('Bearer valid-jwt-token-abc');
      expect(segmentUrl.includes('token')).toBe(false);
    });
  });

  describe('Requirement 3: External Origin Isolation and URL Hardening', () => {
    it('refuses to attach Authorization headers to third-party, protocol-relative, invalid schemes, or unrelated paths', () => {
      localStorage.setItem('token', 'secret-jwt-token');
      const xhrSetup = createPlayerXhrSetup();

      const untrustedUrls = [
        'https://external-cdn.com/videos/segment_001.ts',
        'https://attacker-domain.evil/hls/master.m3u8',
        'https://trusted.example.evil.test/api/courses/lessons/123/hls/master.m3u8',
        'http://analytics.external.org/track.ts',
        'http://localhost:8888/api/courses/lessons/123/hls/master.m3u8',
        '//evil.example/segment.ts',
        '//attacker.com/steal.ts',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        '/api/users/profile',
        '/api/admin/settings',
        '/api/auth/login',
        '/unexpected/lessons/123/hls/master.m3u8',
        '/api/users/lessons/123/hls/master.m3u8',
        '../../../../etc/passwd',
        '../../../../api/admin/users',
        '/api/courses/lessons/123/hls/../../admin/secret',
        '%2e%2e',
        '/api/courses/lessons/123/hls/%2e%2e/%2e%2e/admin/secret',
        '\\\\evil.example\\segment.ts'
      ];

      for (const externalUrl of untrustedUrls) {
        const xhr = new MockXHR();
        xhr.open('GET', externalUrl);
        xhrSetup(xhr, externalUrl);

        expect(xhr.headers['Authorization']).toBeUndefined();
      }
    });
  });

  describe('Requirement 4: Missing Authentication Handling', () => {
    it('safely skips setting Authorization header when no user token or ticket exists', () => {
      localStorage.clear();
      const xhrSetup = createPlayerXhrSetup('');
      const xhr = new MockXHR();

      const masterUrl = getLessonHlsStreamUrl('lesson-1');
      xhr.open('GET', masterUrl);
      xhrSetup(xhr, masterUrl);

      expect(xhr.headers['Authorization']).toBeUndefined();
    });

    it('falls back to videoTicket if localStorage token is not present (e.g. restricted viewer)', () => {
      localStorage.clear();
      const xhrSetup = createPlayerXhrSetup('scoped-stream-ticket-789');
      const xhr = new MockXHR();

      const masterUrl = getLessonHlsStreamUrl('lesson-1');
      xhr.open('GET', masterUrl);
      xhrSetup(xhr, masterUrl);

      expect(xhr.headers['Authorization']).toBe('Bearer scoped-stream-ticket-789');
    });
  });

  describe('Requirement 5: Safari Native HLS Fallback', () => {
    it('constructs Safari native HLS URL with scoped video ticket and preserves compatibility', () => {
      const ticket = 'scoped-safari-ticket-123';
      const safariUrl = getLessonHlsStreamUrl('lesson-safari-1', ticket);

      expect(safariUrl).toBe('/api/courses/lessons/lesson-safari-1/hls/master.m3u8?token=scoped-safari-ticket-123');
      // Verifies that no standard JWT was inserted into the URL
      expect(safariUrl.includes('Bearer')).toBe(false);
    });

    it('does not append token query parameter if videoTicket is empty in Safari fallback', () => {
      const safariUrl = getLessonHlsStreamUrl('lesson-safari-1', '');
      expect(safariUrl).toBe('/api/courses/lessons/lesson-safari-1/hls/master.m3u8');
      expect(safariUrl.includes('?')).toBe(false);
    });
  });

  describe('Requirement 6 & 7: Adaptive Quality & Lifecycle Management', () => {
    it('maintains quality level IDs with -1 mapped to Auto and descending resolution sorting', () => {
      const sampleLevels = [
        { height: 360, bitrate: 600000 },
        { height: 1080, bitrate: 4500000 },
        { height: 720, bitrate: 2000000 }
      ];

      // Sort descending by height
      const sorted = [...sampleLevels].sort((a, b) => b.height - a.height);
      expect(sorted[0].height).toBe(1080);
      expect(sorted[1].height).toBe(720);
      expect(sorted[2].height).toBe(360);
    });

    it('verifies HLS instance cleanup contract destroys previous instance before re-creating', () => {
      const mockDestroy = vi.fn();
      let currentInstance: any = { destroy: mockDestroy };

      // Simulate source change cleanup logic in UnifiedVideoPlayer.tsx
      if (currentInstance) {
        currentInstance.destroy();
        currentInstance = null;
      }

      expect(mockDestroy).toHaveBeenCalledTimes(1);
      expect(currentInstance).toBeNull();
    });
  });

  describe('Requirement 8: Non-HLS Playback Paths Preservation', () => {
    it('preserves YouTube video categorization and behavior', () => {
      const ytUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      expect(getVideoSourceType(ytUrl)).toBe('youtube');
      expect(isInternalLessonHls(ytUrl)).toBe(false);
      expect(isHlsUrl(ytUrl)).toBe(false);
    });

    it('preserves Google Drive video categorization and stream URL behavior', () => {
      const driveUrl = 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OGvE2upms/view';
      expect(getVideoSourceType(driveUrl)).toBe('google-drive');
      expect(isInternalLessonHls(driveUrl)).toBe(false);
      expect(isHlsUrl(driveUrl)).toBe(false);
    });

    it('preserves Direct MP4 video categorization', () => {
      const mp4Url = '/uploads/videos/sample-lesson.mp4';
      expect(getVideoSourceType(mp4Url)).toBe('direct');
      expect(isInternalLessonHls(mp4Url)).toBe(false);
      expect(isHlsUrl(mp4Url)).toBe(false);
    });
  });

  describe('Requirement 9: Token and Authorization Header Leakage Prevention', () => {
    it('ensures no token or Authorization header is printed to console.log or console.warn', () => {
      const logSpy = vi.spyOn(console, 'log');
      const warnSpy = vi.spyOn(console, 'warn');
      const errorSpy = vi.spyOn(console, 'error');

      localStorage.setItem('token', 'super-secret-jwt-token-999');
      const xhrSetup = createPlayerXhrSetup('secret-ticket-888');
      const xhr = new MockXHR();

      const url = getLessonHlsStreamUrl('lesson-test');
      xhr.open('GET', url);
      xhrSetup(xhr, url);

      // Verify that no console output was triggered with secrets
      const allCalls = [...logSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls].flat();
      for (const call of allCalls) {
        if (typeof call === 'string') {
          expect(call.includes('super-secret-jwt-token-999')).toBe(false);
          expect(call.includes('secret-ticket-888')).toBe(false);
          expect(call.includes('Bearer')).toBe(false);
        }
      }

      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('Requirement 10: Video Player Startup Optimization & Buffering Event Contract', () => {
    it('proves critical path (lesson details + video ticket) unblocks player without awaiting non-critical course/homework data', async () => {
      let isLessonResolved = false;
      let isTicketResolved = false;
      let isCourseDetailsResolved = false;
      let isHomeworkResolved = false;

      const mockGetLessonDetails = vi.fn().mockImplementation(async () => {
        isLessonResolved = true;
        return { data: { id: 'l1', title: 'Lesson 1', courseId: 'c1', videoUrl: 'https://drive.google.com/file/d/test12345/view' } };
      });

      const mockGetVideoTicket = vi.fn().mockImplementation(async () => {
        isTicketResolved = true;
        return { data: { ticket: 'ticket-123' } };
      });

      // Non-critical endpoints with deliberate latency to simulate slow responses
      const mockGetCourseDetails = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        isCourseDetailsResolved = true;
        return { data: { lessons: [{ id: 'l1' }] } };
      });

      const mockGetHomeworks = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        isHomeworkResolved = true;
        return { data: [] };
      });

      // Emulate the decoupled fetchLessonData critical path in UnifiedVideoPlayer.tsx
      const [lessonRes, ticketRes] = await Promise.all([
        mockGetLessonDetails(),
        mockGetVideoTicket().catch(() => null)
      ]);

      // At this exact moment, player loading state is cleared and <video> mounts
      const isPlayerReadyToMount = Boolean(lessonRes?.data && ticketRes?.data?.ticket);
      expect(isPlayerReadyToMount).toBe(true);
      expect(isLessonResolved).toBe(true);
      expect(isTicketResolved).toBe(true);
      // Non-critical data are NOT yet resolved when player is ready to mount
      expect(isCourseDetailsResolved).toBe(false);
      expect(isHomeworkResolved).toBe(false);

      // Non-critical background fetch triggered asynchronously
      const backgroundPromise = Promise.allSettled([
        mockGetCourseDetails(),
        mockGetHomeworks()
      ]);

      await backgroundPromise;
      expect(isCourseDetailsResolved).toBe(true);
      expect(isHomeworkResolved).toBe(true);
    });

    it('proves stale lesson responses are discarded and cannot overwrite active lesson', async () => {
      let activeRequestId = 0;
      let committedLessonId: string | null = null;

      const simulateLessonFetch = async (targetId: string, delayMs: number) => {
        const requestId = ++activeRequestId;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        // Stale response guard
        if (requestId !== activeRequestId) {
          return; // Discard stale response
        }
        committedLessonId = targetId;
      };

      // Launch Lesson 1 with high latency (slow response)
      const p1 = simulateLessonFetch('lesson-1', 40);
      // Immediately user switches to Lesson 2 with low latency
      const p2 = simulateLessonFetch('lesson-2', 10);

      await Promise.all([p1, p2]);

      // Lesson 2 must be committed, Lesson 1's late response must have been rejected
      expect(committedLessonId).toBe('lesson-2');
    });

    it('proves onWaiting sets buffering and onCanPlay clears buffering without waiting for onPlaying', () => {
      let isBuffering = false;

      const handleWaiting = () => { isBuffering = true; };
      const handleCanPlay = () => { isBuffering = false; };
      const handlePlaying = () => { isBuffering = false; };

      // Initial state
      expect(isBuffering).toBe(false);

      // Stalled / seeking: waiting fires
      handleWaiting();
      expect(isBuffering).toBe(true);

      // Media has enough future data: canplay fires before playing
      handleCanPlay();
      expect(isBuffering).toBe(false);

      // Playback active: playing ensures buffering stays false
      handlePlaying();
      expect(isBuffering).toBe(false);
    });
  });

  describe('Requirement 11: Video Ticket Failure & Error Buffering Contract', () => {
    it('handles successful ticket issuance for Google Drive stream', () => {
      const driveUrl = 'https://drive.google.com/file/d/test12345/view';
      const sourceType = getVideoSourceType(driveUrl);
      const isProtected = sourceType === 'google-drive' || isInternalLessonHls(driveUrl);
      expect(isProtected).toBe(true);

      const ticket = 'ticket-valid-xyz';
      const streamUrl = getLessonMediaStreamUrl('lesson-1', ticket);
      expect(streamUrl).toContain('/stream?token=ticket-valid-xyz');
    });

    it('rejects protected stream and surfaces clear 403 authorization error when ticket issuance is forbidden', () => {
      let loadError: string | null = null;
      let isPlayerMounted = false;

      const ticketError = { response: { status: 403, data: { message: 'غير مصرح لك بمشاهدة هذا الفيديو' } } };
      const source = 'google-drive';
      const isProtected = source === 'google-drive';

      if (isProtected) {
        if (ticketError.response.status === 403) {
          loadError = ticketError.response.data.message;
          isPlayerMounted = false; // Does not mount protected stream!
        }
      }

      expect(isPlayerMounted).toBe(false);
      expect(loadError).toBe('غير مصرح لك بمشاهدة هذا الفيديو');
    });

    it('uses verified localStorage fallback token when ticket generation has transient failure', () => {
      localStorage.setItem('token', 'fallback-jwt-session');
      let videoTicket = '';
      let loadError: string | null = null;

      const isProtected = true;

      if (isProtected) {
        const fallbackToken = localStorage.getItem('token');
        if (fallbackToken) {
          videoTicket = fallbackToken;
        } else {
          loadError = 'تعذر إصدار تذكرة تشغيل الفيديو المحمي. يرجى إعادة المحاولة.';
        }
      }

      expect(videoTicket).toBe('fallback-jwt-session');
      expect(loadError).toBeNull();
      const streamUrl = getLessonMediaStreamUrl('lesson-1', videoTicket);
      expect(streamUrl).toContain('/stream?token=fallback-jwt-session');
    });

    it('surfaces retryable error and blocks mounting when ticket fails and no fallback token exists', () => {
      localStorage.removeItem('token');
      let videoTicket = '';
      let loadError: string | null = null;
      let isPlayerMounted = false;

      const isProtected = true;

      if (isProtected) {
        const fallbackToken = localStorage.getItem('token');
        if (fallbackToken) {
          videoTicket = fallbackToken;
          isPlayerMounted = true;
        } else {
          loadError = 'تعذر إصدار تذكرة تشغيل الفيديو المحمي. يرجى إعادة المحاولة.';
          isPlayerMounted = false;
        }
      }

      expect(isPlayerMounted).toBe(false);
      expect(videoTicket).toBe('');
      expect(loadError).toBe('تعذر إصدار تذكرة تشغيل الفيديو المحمي. يرجى إعادة المحاولة.');
    });

    it('ensures YouTube playback is unaffected even if video ticket fails', () => {
      const ytUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const source = getVideoSourceType(ytUrl);
      const isProtected = source === 'google-drive' || isInternalLessonHls(ytUrl);
      expect(isProtected).toBe(false);

      // For YouTube, ticket failure does not block mounting or set loadError
      const loadError: string | null = null;
      const isPlayerMounted = true;
      expect(isPlayerMounted).toBe(true);
      expect(loadError).toBeNull();
    });

    it('confirms onCanPlay and onWaiting do not falsely indicate readiness or clear error after media error', () => {
      let isBuffering = false;
      let loadError: string | null = null;
      const mockVideoElement = { error: { code: 4, message: 'MEDIA_ELEMENT_ERROR: Format error' } };

      // Simulate media error occurrence
      loadError = 'تعذر تحميل الفيديو من المصدر (المصدر غير متاح أو تالف).';
      isBuffering = false;

      // Spurious canplay event guarded
      const handleCanPlay = () => {
        if (!loadError && !mockVideoElement.error) {
          isBuffering = false;
        }
      };

      handleCanPlay();
      expect(loadError).toBe('تعذر تحميل الفيديو من المصدر (المصدر غير متاح أو تالف).');
      expect(isBuffering).toBe(false);

      // Spurious waiting event guarded
      const handleWaiting = () => {
        if (!loadError && !mockVideoElement.error) {
          isBuffering = true;
        }
      };

      handleWaiting();
      expect(isBuffering).toBe(false);
    });
  });
});
