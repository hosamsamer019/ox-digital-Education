import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UnifiedVideoPlayer from '../components/video/UnifiedVideoPlayer';

const { mockLessonDetails, courseServiceMock, homeworkServiceMock } = vi.hoisted(() => {
  const details = {
    id: 'lesson-security-test-01',
    courseId: 'course-sec-01',
    title: 'Security & Anti-Cheat Verified Lesson',
    videoUrl: 'https://storage.ox-digital.internal/uploads/lesson-01.mp4',
    activeMediaId: null,
    hasActiveHls: false,
    mediaGeneration: 1,
    quizzes: [],
    progress: []
  };

  return {
    mockLessonDetails: details,
    courseServiceMock: {
      getLessonDetails: vi.fn().mockImplementation(() => Promise.resolve({ data: details })),
      getVideoTicket: vi.fn().mockResolvedValue({ data: { ticket: 'valid-test-ticket' } }),
      getCourseDetails: vi.fn().mockResolvedValue({ data: { lessons: [] } }),
      postLessonEvents: vi.fn().mockResolvedValue({}),
      updateVideoProgress: vi.fn().mockResolvedValue({}),
    },
    homeworkServiceMock: {
      getHomeworksByCourse: vi.fn().mockResolvedValue({ data: [] })
    }
  };
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { id: 'student-sec-01', role: 'STUDENT', name: 'Verified Student' },
    token: 'valid-jwt-token-sec'
  })
}));

vi.mock('../services/course.service', () => ({ courseService: courseServiceMock }));
vi.mock('../../services/course.service', () => ({ courseService: courseServiceMock }));
vi.mock('../services/homework.service', () => ({ homeworkService: homeworkServiceMock }));
vi.mock('../../services/homework.service', () => ({ homeworkService: homeworkServiceMock }));

describe('Video Playback Security & Anti-Cheat Lifecycle Test Suite', () => {
  let playSpy: ReturnType<typeof vi.spyOn>;
  let pauseSpy: ReturnType<typeof vi.spyOn>;
  let loadSpy: ReturnType<typeof vi.spyOn>;
  let removeAttributeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    localStorage.setItem('token', 'valid-jwt-token-sec');

    playSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    pauseSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
      Object.defineProperty(this, 'paused', { value: true, configurable: true, writable: true });
    });
    loadSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    removeAttributeSpy = vi.spyOn(Element.prototype, 'removeAttribute');
  });

  it('1. Halts playback, pauses actual video element on visibilitychange (tab departure), and refuses auto-resume on focus', async () => {
    const { container } = render(
      <MemoryRouter>
        <UnifiedVideoPlayer lessonId="lesson-security-test-01" backUrl="/student/online/courses" mode="online" />
      </MemoryRouter>
    );

    const videoEl = await waitFor(() => {
      const el = container.querySelector('video');
      expect(el).toBeTruthy();
      return el as HTMLVideoElement;
    });

    Object.defineProperty(videoEl, 'paused', { value: false, configurable: true, writable: true });
    fireEvent.play(videoEl);

    // Tab departure: document hidden
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    fireEvent(document, new Event('visibilitychange'));

    expect(pauseSpy).toHaveBeenCalled();
    expect(videoEl.paused).toBe(true);

    expect(screen.getByText('تم إيقاف العرض مؤقتاً')).toBeTruthy();
    expect(screen.getByText('متابعة المشاهدة')).toBeTruthy();

    // Verify Focus does NOT auto-resume playback: playSpy must NOT be called on window focus
    playSpy.mockClear();
    fireEvent(window, new Event('focus'));
    expect(playSpy).not.toHaveBeenCalled();
    expect(screen.getByText('تم إيقاف العرض مؤقتاً')).toBeTruthy();
  });

  it('2. Halts playback and pauses actual video element on window blur with debounce', async () => {
    const { container } = render(
      <MemoryRouter>
        <UnifiedVideoPlayer lessonId="lesson-security-test-01" backUrl="/student/online/courses" mode="online" />
      </MemoryRouter>
    );

    const videoEl = await waitFor(() => {
      const el = container.querySelector('video');
      expect(el).toBeTruthy();
      return el as HTMLVideoElement;
    });

    Object.defineProperty(videoEl, 'paused', { value: false, configurable: true, writable: true });
    fireEvent.play(videoEl);

    // Simulate window blur
    Object.defineProperty(document, 'hasFocus', { value: () => false, configurable: true });
    fireEvent(window, new Event('blur'));

    // Wait for the 150ms debounce
    await waitFor(() => {
      expect(pauseSpy).toHaveBeenCalled();
      expect(videoEl.paused).toBe(true);
      expect(screen.getByText('تم إيقاف العرض مؤقتاً')).toBeTruthy();
    }, { timeout: 1000 });

    // Focus event must not clear overlay or resume play
    playSpy.mockClear();
    fireEvent(window, new Event('focus'));
    expect(playSpy).not.toHaveBeenCalled();
    expect(screen.getByText('تم إيقاف العرض مؤقتاً')).toBeTruthy();
  });

  it('3. Pauses playback, halts progress ticker, and flushes progress on pagehide', async () => {
    const { container } = render(
      <MemoryRouter>
        <UnifiedVideoPlayer lessonId="lesson-security-test-01" backUrl="/student/online/courses" mode="online" />
      </MemoryRouter>
    );

    const videoEl = await waitFor(() => {
      const el = container.querySelector('video');
      expect(el).toBeTruthy();
      return el as HTMLVideoElement;
    });

    Object.defineProperty(videoEl, 'currentTime', { value: 45, configurable: true, writable: true });
    Object.defineProperty(videoEl, 'duration', { value: 120, configurable: true, writable: true });

    fireEvent(window, new Event('pagehide'));
    expect(pauseSpy).toHaveBeenCalled();
    expect(courseServiceMock.updateVideoProgress).toHaveBeenCalledWith(
      'lesson-security-test-01',
      expect.objectContaining({
        progress: expect.any(Number),
        watched: expect.any(Boolean),
        lastTimestamp: 45
      })
    );
  });

  it('4. Resumes playback and dismisses overlay only when student clicks "متابعة المشاهدة"', async () => {
    const { container } = render(
      <MemoryRouter>
        <UnifiedVideoPlayer lessonId="lesson-security-test-01" backUrl="/student/online/courses" mode="online" />
      </MemoryRouter>
    );

    const videoEl = await waitFor(() => {
      const el = container.querySelector('video');
      expect(el).toBeTruthy();
      return el as HTMLVideoElement;
    });

    // Trigger blur pause
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    fireEvent(document, new Event('visibilitychange'));

    expect(screen.getByText('تم إيقاف العرض مؤقتاً')).toBeTruthy();

    // Repeated blur events must not create duplicate overlays
    fireEvent(document, new Event('visibilitychange'));
    expect(screen.getAllByText('تم إيقاف العرض مؤقتاً')).toHaveLength(1);

    // Click Continue Watching button
    const continueBtn = screen.getByText('متابعة المشاهدة');
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(screen.queryByText('تم إيقاف العرض مؤقتاً')).toBeNull();
    });
    expect(playSpy).toHaveBeenCalled();
  });

  it('5. Component unmount halts media, removes source, flushes buffers, and cleans up event listeners', async () => {
    const { container, unmount } = render(
      <MemoryRouter>
        <UnifiedVideoPlayer lessonId="lesson-security-test-01" backUrl="/student/online/courses" mode="online" />
      </MemoryRouter>
    );

    await waitFor(() => {
      const el = container.querySelector('video');
      expect(el).toBeTruthy();
    });

    pauseSpy.mockClear();
    loadSpy.mockClear();

    unmount();

    expect(pauseSpy).toHaveBeenCalled();
    expect(removeAttributeSpy).toHaveBeenCalledWith('src');
    expect(loadSpy).toHaveBeenCalled();

    // Firing events post-unmount must not trigger errors or pause calls
    pauseSpy.mockClear();
    fireEvent(window, new Event('blur'));
    fireEvent(window, new Event('pagehide'));
    expect(pauseSpy).not.toHaveBeenCalled();
  });

  it('6. Continue button aborts and redirects when authenticated token is missing/expired', async () => {
    const { container } = render(
      <MemoryRouter>
        <UnifiedVideoPlayer lessonId="lesson-security-test-01" backUrl="/student/online/courses" mode="online" />
      </MemoryRouter>
    );

    await waitFor(() => {
      const el = container.querySelector('video');
      expect(el).toBeTruthy();
    });

    // Trigger blur
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    fireEvent(document, new Event('visibilitychange'));

    expect(screen.getByText('تم إيقاف العرض مؤقتاً')).toBeTruthy();

    // Remove token (simulating expired session)
    localStorage.removeItem('token');

    playSpy.mockClear();
    const continueBtn = screen.getByText('متابعة المشاهدة');
    fireEvent.click(continueBtn);

    // Play must NOT be called when session is expired
    expect(playSpy).not.toHaveBeenCalled();
  });

  it('7. Unrelated third-party iframe focus does NOT bypass blur anti-cheat pause', async () => {
    const { container } = render(
      <MemoryRouter>
        <UnifiedVideoPlayer lessonId="lesson-security-test-01" backUrl="/student/online/courses" mode="online" />
      </MemoryRouter>
    );

    const videoEl = await waitFor(() => {
      const el = container.querySelector('video');
      expect(el).toBeTruthy();
      return el as HTMLVideoElement;
    });

    Object.defineProperty(videoEl, 'paused', { value: false, configurable: true, writable: true });

    // Create an external iframe outside the player container
    const externalIframe = document.createElement('iframe');
    document.body.appendChild(externalIframe);

    Object.defineProperty(document, 'activeElement', { value: externalIframe, configurable: true });
    Object.defineProperty(document, 'hasFocus', { value: () => false, configurable: true });

    pauseSpy.mockClear();
    fireEvent(window, new Event('blur'));

    await waitFor(() => {
      expect(pauseSpy).toHaveBeenCalled();
      expect(videoEl.paused).toBe(true);
      expect(screen.getByText('تم إيقاف العرض مؤقتاً')).toBeTruthy();
    }, { timeout: 1000 });

    document.body.removeChild(externalIframe);
  });

  it('8. Continue button revalidates server video authorization and aborts if server returns 403 / revoked access', async () => {
    const { container } = render(
      <MemoryRouter>
        <UnifiedVideoPlayer lessonId="lesson-security-test-01" backUrl="/student/online/courses" mode="online" />
      </MemoryRouter>
    );

    await waitFor(() => {
      const el = container.querySelector('video');
      expect(el).toBeTruthy();
    });

    // Trigger blur
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    fireEvent(document, new Event('visibilitychange'));
    expect(screen.getByText('تم إيقاف العرض مؤقتاً')).toBeTruthy();

    // Mock getVideoTicket rejecting with 403 (revoked access / expired ticket)
    courseServiceMock.getVideoTicket.mockRejectedValueOnce({
      response: { status: 403, data: { message: 'Access revoked' } }
    });

    playSpy.mockClear();
    const continueBtn = screen.getByText('متابعة المشاهدة');
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(courseServiceMock.getVideoTicket).toHaveBeenCalledWith('lesson-security-test-01');
    });

    // Play must NOT be resumed when server authorization check fails
    expect(playSpy).not.toHaveBeenCalled();
  });

  it('9. Pageshow event with persisted: true halts playback and activates security pause', async () => {
    const { container } = render(
      <MemoryRouter>
        <UnifiedVideoPlayer lessonId="lesson-security-test-01" backUrl="/student/online/courses" mode="online" />
      </MemoryRouter>
    );

    const videoEl = await waitFor(() => {
      const el = container.querySelector('video');
      expect(el).toBeTruthy();
      return el as HTMLVideoElement;
    });

    Object.defineProperty(videoEl, 'paused', { value: false, configurable: true, writable: true });
    pauseSpy.mockClear();

    // Dispatch pageshow with persisted: true (bfcache restoration)
    const pageShowEvent = new Event('pageshow');
    Object.defineProperty(pageShowEvent, 'persisted', { value: true });
    fireEvent(window, pageShowEvent);

    expect(pauseSpy).toHaveBeenCalled();
    expect(videoEl.paused).toBe(true);
    expect(screen.getByText('تم إيقاف العرض مؤقتاً')).toBeTruthy();
  });

  it('10. Mutes HTML video element on pause to prevent background audio leaks', async () => {
    const { container } = render(
      <MemoryRouter>
        <UnifiedVideoPlayer lessonId="lesson-security-test-01" backUrl="/student/online/courses" mode="online" />
      </MemoryRouter>
    );

    const videoEl = await waitFor(() => {
      const el = container.querySelector('video');
      expect(el).toBeTruthy();
      return el as HTMLVideoElement;
    });

    videoEl.muted = false;
    fireEvent(document, new Event('visibilitychange'));

    expect(videoEl.muted).toBe(true);
  });
});
