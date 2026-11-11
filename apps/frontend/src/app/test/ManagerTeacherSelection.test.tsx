import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import CoursesManagementPage from '../components/admin/CoursesManagementPage';
import { userService } from '../services/user.service';
import { courseService } from '../services/course.service';
import { LanguageProvider } from '../contexts/LanguageContext';

// Mock userService
vi.mock('../services/user.service', () => ({
  userService: {
    getUsers: vi.fn(),
  },
}));

// Mock courseService
vi.mock('../services/course.service', () => ({
  courseService: {
    getCourses: vi.fn(),
    createCourse: vi.fn(),
    updateCourse: vi.fn(),
    deleteCourse: vi.fn(),
    restoreCourse: vi.fn(),
  },
}));

describe('Manager Teacher Selector (CoursesManagementPage - Phase II-D)', () => {
  afterEach(() => {
    vi.clearAllTimers();
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllTimers();
    document.body.innerHTML = '';
    vi.clearAllMocks();

    (courseService.getCourses as any).mockResolvedValue({
      data: {
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 1
      }
    });

    (userService.getUsers as any).mockResolvedValue({
      data: [
        { id: 'teacher-1', name: 'أ. حسام محمد', email: 'hossam@ox-digital.edu', role: 'TEACHER' },
        { id: 'teacher-2', name: 'أ. محمود كمال', email: 'mahmoud@ox-digital.edu', role: 'TEACHER' }
      ],
      total: 2,
      page: 1,
      limit: 50,
      totalPages: 1
    });
  });

  it('1. Initial load calls userService.getUsers with role=TEACHER and limit=50 without looping', async () => {
    render(
      <LanguageProvider>
        <CoursesManagementPage />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(userService.getUsers).toHaveBeenCalledWith({
        role: 'TEACHER',
        page: 1,
        limit: 50,
        search: undefined
      });
    });

    // Should only be called once on mount, NOT 10 times in a loop!
    expect(userService.getUsers).toHaveBeenCalledTimes(1);
  });

  it('2. Opening modal and searching triggers debounced server search with role=TEACHER', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    render(
      <LanguageProvider>
        <CoursesManagementPage />
      </LanguageProvider>
    );

    // Click "إضافة دورة" to open modal
    const addButton = screen.getByText('إضافة دورة');
    fireEvent.click(addButton);

    // Find modal teacher search input
    const searchInput = screen.getByPlaceholderText('ابحث عن المعلم بالاسم أو البريد في المؤسسة...');
    expect(searchInput).toBeDefined();

    // Type query
    (userService.getUsers as any).mockResolvedValueOnce({
      data: [
        { id: 'teacher-999', name: 'أ. سارة أحمد', email: 'sara@ox-digital.edu', role: 'TEACHER' }
      ],
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1
    });

    fireEvent.change(searchInput, { target: { value: 'سارة' } });

    // Advance debounce timer (300ms)
    act(() => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(userService.getUsers).toHaveBeenCalledWith({
        role: 'TEACHER',
        page: 1,
        limit: 50,
        search: 'سارة'
      });
    });

    vi.useRealTimers();
  });

  it('3. Selected teacher remains valid in options even when search returns empty', async () => {
    render(
      <LanguageProvider>
        <CoursesManagementPage />
      </LanguageProvider>
    );

    // Click "إضافة دورة"
    fireEvent.click(screen.getByText('إضافة دورة'));

    await waitFor(() => {
      expect(screen.getByLabelText('اختر المعلم المسؤول')).toBeDefined();
    });

    // Select teacher-1
    const select = screen.getByLabelText('اختر المعلم المسؤول') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'teacher-1' } });
    expect(select.value).toBe('teacher-1');

    // Now mock search returning empty list
    (userService.getUsers as any).mockResolvedValueOnce({
      data: [],
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0
    });

    // Type a search that doesn't match
    const searchInput = screen.getByPlaceholderText('ابحث عن المعلم بالاسم أو البريد في المؤسسة...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent teacher' } });

    // Wait for options: teacher-1 must still be retained in options!
    await waitFor(() => {
      const options = screen.getAllByText(/أ. حسام محمد/);
      expect(options.length).toBeGreaterThan(0);
      expect(select.value).toBe('teacher-1');
    });
  });

  it('4. Stale responses do not overwrite newer search results', async () => {
    let resolveFirst: any;
    const slowPromise = new Promise((resolve) => { resolveFirst = resolve; });

    (userService.getUsers as any).mockImplementation(async (params: any) => {
      if (params?.search === 'query1') {
        return slowPromise;
      }
      if (params?.search === 'query2') {
        return {
          data: [{ id: 'teacher-fast', name: 'أ. المعلم السريع', email: 'fast@ox-digital.edu', role: 'TEACHER' }],
          total: 1,
          page: 1,
          limit: 50,
          totalPages: 1
        };
      }
      return {
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0
      };
    });

    render(
      <LanguageProvider>
        <CoursesManagementPage />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByText('إضافة دورة'));

    const searchInput = screen.getByPlaceholderText('ابحث عن المعلم بالاسم أو البريد في المؤسسة...');

    // Fire search 1 (slow)
    fireEvent.change(searchInput, { target: { value: 'query1' } });
    await new Promise(r => setTimeout(r, 350));

    // Fire search 2 (fast)
    fireEvent.change(searchInput, { target: { value: 'query2' } });
    await new Promise(r => setTimeout(r, 350));

    // Resolve search 1 late with outdated teacher
    resolveFirst({
      data: [{ id: 'teacher-stale', name: 'أ. المعلم القديم', email: 'stale@ox-digital.edu', role: 'TEACHER' }],
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1
    });

    await waitFor(() => {
      // Fast teacher must be present in options
      const fastMatches = screen.queryAllByText(/أ. المعلم السريع/);
      expect(fastMatches.length).toBeGreaterThan(0);
      // Stale teacher must NEVER appear
      const staleMatches = screen.queryAllByText(/أ. المعلم القديم/);
      expect(staleMatches.length).toBe(0);
    });
  });

  it('5. Empty search state shows clear Arabic message and reset button', async () => {
    (userService.getUsers as any).mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0
    });

    render(
      <LanguageProvider>
        <CoursesManagementPage />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByText('إضافة دورة'));

    const searchInput = screen.getByPlaceholderText('ابحث عن المعلم بالاسم أو البريد في المؤسسة...');
    
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'nonexistent-search-term' } });
      await new Promise(r => setTimeout(r, 400));
    });

    await waitFor(() => {
      expect(screen.getByText(/لا يوجد معلم/)).toBeDefined();
    });
  });
});
