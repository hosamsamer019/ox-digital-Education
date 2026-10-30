import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UnifiedVideoPlayer from '../components/video/UnifiedVideoPlayer';
import * as videoUtils from '../utils/videoUtils';

const { mockLessonDetails, mockEventHandlers, courseServiceMock, homeworkServiceMock } = vi.hoisted(() => {
  const details = {
    id: '8003a954-fbe4-492c-871a-21776f22d427',
    courseId: '53d6bf94-2ad9-47bb-96d0-46fb4aa36b58',
    title: '[DEV-TEST] Google Drive HLS Ingestion run-20261026-215500',
    videoUrl: 'https://drive.google.com/file/d/1GpUrvzEoEshP6ExyC4ced8nAdEtF1_G-/view?usp=drive_link',
    activeMediaId: '7f17a981-22d2-4023-bfa3-3393882a989c',
    hasActiveHls: true,
    mediaGeneration: 1,
    quizzes: [],
    progress: []
  };

  return {
    mockLessonDetails: details,
    mockEventHandlers: {} as Record<string, Function[]>,
    courseServiceMock: {
      getLessonDetails: vi.fn().mockImplementation(() => Promise.resolve({ data: details })),
      getVideoTicket: vi.fn().mockResolvedValue({ data: { ticket: 'dev-test-ticket-xyz' } }),
      getCourseDetails: vi.fn().mockResolvedValue({ data: { lessons: [] } }),
      postLessonEvents: vi.fn().mockResolvedValue({}),
      updateVideoProgress: vi.fn().mockResolvedValue({}),
    },
    homeworkServiceMock: {
      getHomeworksByCourse: vi.fn().mockResolvedValue({ data: [] })
    }
  };
});

let mockHlsInstance: any = null;

// Mock AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { id: 'teacher-1', role: 'TEACHER', name: 'Test Teacher' },
    token: 'valid-jwt-token-xyz'
  })
}));

vi.mock('../services/course.service', () => ({ courseService: courseServiceMock }));
vi.mock('../../services/course.service', () => ({ courseService: courseServiceMock }));
vi.mock('../services/homework.service', () => ({ homeworkService: homeworkServiceMock }));
vi.mock('../../services/homework.service', () => ({ homeworkService: homeworkServiceMock }));

// Mock hls.js with full event lifecycle support
vi.mock('hls.js', () => {
  class MockHls {
    static Events = {
      MEDIA_ATTACHED: 'hlsMediaAttached',
      MANIFEST_PARSED: 'hlsManifestParsed',
      LEVEL_SWITCHED: 'hlsLevelSwitched',
      ERROR: 'hlsError'
    };
    static ErrorTypes = {
      NETWORK_ERROR: 'networkError',
      MEDIA_ERROR: 'mediaError'
    };
    static isSupported = vi.fn().mockReturnValue(true);

    public levels = [
      { height: 720, width: 1280, bitrate: 2628000, name: '720p' },
      { height: 480, width: 854, bitrate: 1296000, name: '480p' },
      { height: 360, width: 640, bitrate: 664000, name: '360p' }
    ];
    public currentLevel = -1;
    public attachMedia = vi.fn((_video: any) => {
      setTimeout(() => {
        this.trigger(MockHls.Events.MEDIA_ATTACHED);
      }, 0);
    });
    public loadSource = vi.fn((_url: string) => {
      setTimeout(() => {
        this.trigger(MockHls.Events.MANIFEST_PARSED, { levels: this.levels });
      }, 10);
    });
    public destroy = vi.fn();
    public on = vi.fn((event: string, handler: Function) => {
      if (!mockEventHandlers[event]) mockEventHandlers[event] = [];
      mockEventHandlers[event].push(handler);
    });

    trigger(event: string, data?: any) {
      if (mockEventHandlers[event]) {
        mockEventHandlers[event].forEach(fn => fn(event, data));
      }
    }

    constructor() {
      mockHlsInstance = this;
    }
  }

  return { default: MockHls };
});

describe('Phase 2.6 — Frontend HLS Resolver & Quality Selector E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key in mockEventHandlers) {
      delete mockEventHandlers[key];
    }
  });

  it('Stage 17: Verifies hasActiveHls triggers HLS resolver precedence over Drive progressive /stream', () => {
    const isDriveActiveHls = videoUtils.hasActiveHlsMedia(mockLessonDetails);
    expect(isDriveActiveHls).toBe(true);

    const isInternalHls = isDriveActiveHls;
    const resolvedUrl = isInternalHls
      ? videoUtils.getLessonHlsStreamUrl(mockLessonDetails.id)
      : videoUtils.getLessonMediaStreamUrl(mockLessonDetails.id, 'ticket-xyz');

    expect(resolvedUrl).toBe(`/api/courses/lessons/${mockLessonDetails.id}/hls/master.m3u8`);
    expect(resolvedUrl.includes('/stream')).toBe(false);
  });

  it('Stage 18, 19, 20: Renders UnifiedVideoPlayer, mounts HLS engine, discovers levels, and displays Quality Selector UI', async () => {
    render(
      <MemoryRouter>
        <UnifiedVideoPlayer lessonId={mockLessonDetails.id} backUrl="/courses" />
      </MemoryRouter>
    );

    // Verify hls.js attaches and loads the authenticated master playlist
    await waitFor(() => {
      expect(mockHlsInstance).not.toBeNull();
      expect(mockHlsInstance.loadSource).toHaveBeenCalledWith(
        `/api/courses/lessons/${mockLessonDetails.id}/hls/master.m3u8`
      );
    });

    // Wait for MANIFEST_PARSED and quality selector button to render in DOM
    const qualityButton = await screen.findByRole('button', { name: /جودة الفيديو/i });
    expect(qualityButton).toBeInTheDocument();
    expect(qualityButton).toBeVisible();

    // Verify initial quality label is Auto (تلقائي)
    expect(qualityButton.textContent).toContain('تلقائي');

    // Click the Quality Selector button to open the menu
    fireEvent.click(qualityButton);

    // Verify all renditions discovered from master manifest are available in the dropdown
    await waitFor(() => {
      expect(screen.getByText('تلقائي (Auto)')).toBeInTheDocument();
      expect(screen.getByText('720p HD')).toBeInTheDocument();
      expect(screen.getByText('480p')).toBeInTheDocument();
      expect(screen.getByText('360p')).toBeInTheDocument();
    });

    // Select 720p HD quality option
    const option720p = screen.getByText('720p HD');
    fireEvent.click(option720p);

    // Verify quality switch was dispatched to HLS instance
    expect(mockHlsInstance.currentLevel).toBe(0); // 720p is level 0
  });
});
