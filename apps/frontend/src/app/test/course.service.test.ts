import { courseService } from '../services/course.service';
import { courseApi } from '../services/api';
import { vi } from 'vitest';

vi.mock('../services/api', () => ({
  courseApi: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('courseService', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('getCourses calls correct api endpoint', async () => {
    const mockData = { data: { data: [{ id: '1', title: 'Test Course' }] } };
    (courseApi.get as any).mockResolvedValue(mockData);

    const result = await courseService.getCourses();
    
    expect(courseApi.get).toHaveBeenCalledWith('/', { params: undefined });
    expect(result).toEqual(mockData);
  });

  it('deleteCourse calls DELETE /:id endpoint for safe soft-archival', async () => {
    const mockData = { data: { message: 'تمت أرشفة الدورة وحذفها بنجاح', action: 'ARCHIVED' } };
    (courseApi.delete as any).mockResolvedValue(mockData);

    const result = await courseService.deleteCourse('course-123');

    expect(courseApi.delete).toHaveBeenCalledWith('/course-123');
    expect(result).toEqual(mockData);
  });

  it('restoreCourse calls POST /:id/restore endpoint for restoring to DRAFT', async () => {
    const mockData = { data: { message: 'تمت استعادة الدورة بنجاح كمسودة', action: 'RESTORED' } };
    (courseApi.post as any).mockResolvedValue(mockData);

    const result = await courseService.restoreCourse('course-123');

    expect(courseApi.post).toHaveBeenCalledWith('/course-123/restore');
    expect(result).toEqual(mockData);
  });
});
