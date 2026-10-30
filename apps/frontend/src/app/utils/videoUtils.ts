export const isGoogleDriveUrl = (url?: string | null): boolean => {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  return trimmed.includes('drive.google.com') ||
         trimmed.includes('docs.google.com') ||
         trimmed.includes('drive.usercontent.google.com') ||
         trimmed.includes('googleusercontent.com');
};

export const extractGoogleDriveId = (url?: string | null): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  // Match /file/d/ID or /d/ID
  const fileMatch = trimmed.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]{10,})/);
  if (fileMatch && fileMatch[1]) {
    return fileMatch[1];
  }
  // Match ?id=ID or &id=ID
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }
  // If raw file ID
  if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
};

export const getGoogleDrivePreviewUrl = (url?: string | null): string | null => {
  const id = extractGoogleDriveId(url);
  if (!id) return null;
  return `https://drive.google.com/file/d/${id}/preview`;
};

export const extractYouTubeVideoId = (url?: string | null): string | null => {
  if (!url) return null;
  const trimmed = url.trim();

  // If already an 11-character YouTube ID directly
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Common YouTube URL formats (watch, youtu.be, embed, shorts, live, etc.)
  const regExp = /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|live\/|shorts\/|watch\?(?:.*&)?v=)([^#&?]*).*/;
  const match = trimmed.match(regExp);

  if (match && match[1] && match[1].length === 11) {
    return match[1];
  }

  return null;
};

export const extractVimeoId = (url?: string | null): string | null => {
  if (!url) return null;
  const match = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/);
  return match && match[1] ? match[1] : null;
};

export const isHlsUrl = (url?: string | null): boolean => {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed, 'https://dummy.local');
    return /\.m3u8$/i.test(parsed.pathname);
  } catch {
    const cleanPath = trimmed.split(/[?#]/)[0];
    return /\.m3u8$/i.test(cleanPath);
  }
};

export const isDirectVideoUrl = (url?: string | null): boolean => {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:video/')) return true;
  if (trimmed.includes('/uploads/videos/') || trimmed.includes('/uploads/')) return true;
  return /\.(mp4|webm|ogg|mov|m4v|m3u8)(\?.*)?$/i.test(trimmed);
};

export type VideoSourceType = 'youtube' | 'direct' | 'google-drive' | 'vimeo' | 'unknown';

export const getVideoSourceType = (url?: string | null): VideoSourceType => {
  if (!url) return 'unknown';
  if (isGoogleDriveUrl(url)) return 'google-drive';
  if (extractYouTubeVideoId(url)) return 'youtube';
  if (extractVimeoId(url)) return 'vimeo';
  if (isDirectVideoUrl(url)) return 'direct';
  return 'unknown';
};

export const getNormalizedVideoUrl = (url?: string | null): string => {
  if (!url) return '';
  const trimmed = url.trim();
  // Handle relative uploads if running on client
  if (trimmed.startsWith('/uploads/')) {
    return trimmed;
  }
  return trimmed;
};

export const getVideoThumbnailUrl = (videoUrl?: string | null): string => {
  const defaultThumb = 'https://images.unsplash.com/photo-1509228627152-72ae9ae6848d?w=800&h=450&fit=crop';
  if (!videoUrl) return defaultThumb;

  const ytId = extractYouTubeVideoId(videoUrl);
  if (ytId) {
    return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  }

  return defaultThumb;
};

export const formatVideoTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const totalSeconds = Math.floor(seconds);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const paddedMins = String(mins).padStart(2, '0');
  const paddedSecs = String(secs).padStart(2, '0');

  if (hrs > 0) {
    return `${hrs}:${paddedMins}:${paddedSecs}`;
  }
  return `${paddedMins}:${paddedSecs}`;
};

export const formatVideoTimeRemaining = (current: number, duration: number): string => {
  if (!duration || isNaN(duration) || duration <= 0) return '00:00';
  const remaining = Math.max(0, duration - (current || 0));
  return `-${formatVideoTime(remaining)}`;
};

export const getLessonMediaStreamUrl = (lessonId: string, token?: string): string => {
  const env: any = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
  const baseUrl = env.VITE_COURSE_API_URL || '/api/courses';
  const authToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '') || '';
  return `${baseUrl}/lessons/${lessonId}/stream${authToken ? `?token=${encodeURIComponent(authToken)}` : ''}`;
};

export const getLessonHlsStreamUrl = (lessonId: string, token?: string): string => {
  const env: any = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
  const baseUrl = env.VITE_COURSE_API_URL || '/api/courses';
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${baseUrl}/lessons/${lessonId}/hls/master.m3u8${query}`;
};

export const isInternalGatewayUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('\\') || trimmed.includes('\0')) {
    return false;
  }

  const env: any = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : ((globalThis as any).process?.env || {});
  const courseApiUrl = env.VITE_COURSE_API_URL;
  const defaultOrigin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'http://localhost';

  const allowedOrigins = new Set<string>();
  try {
    allowedOrigins.add(new URL(defaultOrigin).origin);
  } catch {
    allowedOrigins.add('http://localhost');
  }

  if (courseApiUrl && /^https?:\/\//i.test(courseApiUrl)) {
    try {
      const parsedCourseUrl = new URL(courseApiUrl);
      allowedOrigins.add(parsedCourseUrl.origin);
    } catch {}
  }

  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    allowedOrigins.add('http://localhost');
    allowedOrigins.add('https://localhost');
    allowedOrigins.add('http://127.0.0.1');
    allowedOrigins.add('https://127.0.0.1');
    allowedOrigins.add('http://localhost:4004');
    allowedOrigins.add('http://127.0.0.1:4004');
    allowedOrigins.add('http://localhost:3000');
    allowedOrigins.add('http://127.0.0.1:3000');
    allowedOrigins.add('http://localhost:5173');
    allowedOrigins.add('http://127.0.0.1:5173');
  }

  // Derive configured base pathname for gateway resolution and validation
  let configuredBasePath = '/api/courses';
  if (courseApiUrl) {
    try {
      const parsed = new URL(courseApiUrl, 'http://localhost');
      configuredBasePath = parsed.pathname.replace(/\/+$/, '') || '/api/courses';
    } catch {
      configuredBasePath = '/api/courses';
    }
  }

  const basePrefix = (courseApiUrl && /^https?:\/\//i.test(courseApiUrl))
    ? courseApiUrl.replace(/\/+$/, '')
    : `${defaultOrigin}${configuredBasePath}`;

  const gatewayBase = `${basePrefix}/lessons/_/hls/master.m3u8`;

  try {
    const resolved = new URL(trimmed, gatewayBase);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      return false;
    }
    if (!allowedOrigins.has(resolved.origin)) {
      return false;
    }

    // Reject percent-encoded traversal and separator bypass attempts in pathname
    if (/%2e/i.test(resolved.pathname) || /%2f/i.test(resolved.pathname) || /%5c/i.test(resolved.pathname)) {
      return false;
    }

    // Build strictly anchored gateway pathname pattern
    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const allowedPrefixes = ['/api/courses'];
    if (configuredBasePath && configuredBasePath !== '/api/courses') {
      allowedPrefixes.push(configuredBasePath);
    }
    const prefixPattern = allowedPrefixes.map(escapeRegex).join('|');
    const gatewayPathRegex = new RegExp(`^(${prefixPattern})\\/lessons\\/[^/]+\\/(hls|stream)(\\/.*)?$`);

    return gatewayPathRegex.test(resolved.pathname);
  } catch {
    return false;
  }
};

export const isInternalLessonHls = (videoUrl?: string | null): boolean => {
  if (!videoUrl) return false;
  const trimmed = videoUrl.trim();
  return (
    trimmed.includes('/hls/') ||
    trimmed.includes('master.m3u8') ||
    trimmed.startsWith('videos/') ||
    trimmed.startsWith('upload:') ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)
  );
};

export const hasActiveHlsMedia = (lesson?: {
  videoUrl?: string | null;
  activeMediaId?: string | null;
  hasActiveHls?: boolean;
  activeMedia?: { status?: string; canonicalSource?: string; masterPlaylistKey?: string | null } | null;
} | null): boolean => {
  if (!lesson) return false;
  if (lesson.hasActiveHls === true) return true;

  // Direct HLS reference in videoUrl
  if (isInternalLessonHls(lesson.videoUrl)) return true;

  // Active completed ProcessedMedia matching current Google Drive source
  if (
    lesson.activeMediaId &&
    lesson.activeMedia &&
    lesson.activeMedia.status === 'COMPLETED' &&
    lesson.videoUrl &&
    isGoogleDriveUrl(lesson.videoUrl)
  ) {
    const driveId = extractGoogleDriveId(lesson.videoUrl);
    if (driveId && lesson.activeMedia.canonicalSource === `gdrive:${driveId}`) {
      return true;
    }
  }

  return false;
};


