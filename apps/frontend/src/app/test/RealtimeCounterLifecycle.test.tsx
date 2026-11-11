import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSmartNavigationCounters } from '../hooks/useSmartNavigationCounters';
import { notificationService } from '../services/notification.service';
import { accountingService } from '../services/accounting.service';
import { homeworkService } from '../services/homework.service';
import type { MenuItem } from '../components/shared/SharedLayout';

const MockIcon: React.ComponentType<{ className?: string }> = () => null;

// Typed in-file mock socket implementing on/off/emit/removeAllListeners without Node 'events'
type SocketListener = (...args: any[]) => void;

class MockSocket {
  connected: boolean = true;
  private listeners: Map<string, Set<SocketListener>> = new Map();

  on(event: string, listener: SocketListener): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return this;
  }

  off(event: string, listener: SocketListener): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return false;
    Array.from(handlers).forEach((fn) => fn(...args));
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

let mockSocketInstance: MockSocket;
let currentSocketConnected = true;

let currentMockUser: any = {
  id: 'user-manager-1',
  name: 'Primary Manager',
  email: 'manager@ox-digital.edu',
  role: 'PRIMARY_MANAGER',
  institutionId: 'inst-001'
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: currentMockUser,
    token: 'mock-token',
    logout: vi.fn(),
    isAuthenticated: !!currentMockUser,
  }),
}));

vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => ({
    socket: mockSocketInstance,
    connected: currentSocketConnected,
  }),
}));

vi.mock('../services/accounting.service', () => ({
  accountingService: {
    getExpenses: vi.fn(),
  },
}));

vi.mock('../services/notification.service', () => ({
  notificationService: {
    getUnreadCount: vi.fn(),
  },
}));

vi.mock('../services/homework.service', () => ({
  homeworkService: {
    getHomeworks: vi.fn(),
    getPendingCount: vi.fn(),
  },
}));

describe('Smart Navigation Realtime Counter Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocketInstance = new MockSocket();
    currentSocketConnected = true;
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', 'valid-jwt-token');
    }

    // Default service responses
    vi.mocked(notificationService.getUnreadCount).mockResolvedValue({
      data: { unreadCount: 0 }
    } as any);

    vi.mocked(accountingService.getExpenses).mockResolvedValue({
      vouchers: []
    } as any);

    vi.mocked(homeworkService.getHomeworks).mockResolvedValue({
      data: { data: [] }
    } as any);

    vi.mocked(homeworkService.getPendingCount).mockResolvedValue({
      data: { pendingCount: 0, total: 0 }
    } as any);
  });

  afterEach(() => {
    mockSocketInstance.removeAllListeners();
  });

  it('1. Initial Load: Authoritative retrieval of role-specific counters', async () => {
    currentMockUser = {
      id: 'manager-101',
      role: 'PRIMARY_MANAGER',
      institutionId: 'inst-001'
    };

    vi.mocked(notificationService.getUnreadCount).mockResolvedValueOnce({
      data: { unreadCount: 3 }
    } as any);

    vi.mocked(accountingService.getExpenses).mockResolvedValueOnce({
      vouchers: [
        { id: 'exp-1', status: 'PENDING_APPROVAL', amount: 500 },
        { id: 'exp-2', status: 'PENDING_APPROVAL', amount: 750 },
        { id: 'exp-3', status: 'APPROVED', amount: 100 }
      ]
    } as any);

    const { result } = renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      expect(result.current.counters.pendingApprovals).toBe(2);
      expect(result.current.counters.unreadNotifications).toBe(3);
      expect(result.current.counters.pendingHomework).toBe(0);
      expect(result.current.counters.pendingDisbursements).toBe(0);
    });
  });

  it('2. Zero Counter Semantics: Clean navigation without ghost badges (badge is undefined)', async () => {
    currentMockUser = {
      id: 'manager-102',
      role: 'ADMIN',
      institutionId: 'inst-001'
    };

    vi.mocked(notificationService.getUnreadCount).mockResolvedValueOnce({
      data: { unreadCount: 0 }
    } as any);
    vi.mocked(accountingService.getExpenses).mockResolvedValueOnce({
      vouchers: []
    } as any);

    const { result } = renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      expect(result.current.counters.pendingApprovals).toBe(0);
    });

    const items: MenuItem[] = [
      { label: 'الاعتمادات', icon: MockIcon, path: '/admin/approvals' }
    ];

    const decorated = result.current.applyBadgesToMenuItems(items);
    expect(decorated[0].badge).toBeUndefined();
  });

  it('3. Accountant Counter: Monitors approved vouchers awaiting disbursement', async () => {
    currentMockUser = {
      id: 'accountant-01',
      role: 'ACCOUNTANT',
      institutionId: 'inst-001'
    };

    vi.mocked(accountingService.getExpenses).mockResolvedValueOnce({
      vouchers: [
        { id: 'exp-10', status: 'APPROVED', amount: 200 },
        { id: 'exp-11', status: 'APPROVED', amount: 350 },
        { id: 'exp-12', status: 'PAID', amount: 150 },
        { id: 'exp-13', status: 'REJECTED', amount: 90 }
      ]
    } as any);

    const { result } = renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      expect(result.current.counters.pendingDisbursements).toBe(2);
    });

    const items: MenuItem[] = [
      { label: 'المصروفات', icon: MockIcon, path: '/accountant/expenses' }
    ];

    const decorated = result.current.applyBadgesToMenuItems(items);
    expect(decorated[0].badge).toBe(2);
  });

  it('4. Student Counter: Uses authoritative backend getPendingCount consistently for online & center students', async () => {
    currentMockUser = {
      id: 'student-01',
      role: 'ONLINE_STUDENT',
      institutionId: 'inst-001'
    };

    vi.mocked(homeworkService.getPendingCount).mockResolvedValueOnce({
      data: { pendingCount: 12, total: 18 }
    } as any);

    const { result } = renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      expect(result.current.counters.pendingHomework).toBe(12);
    });

    const items: MenuItem[] = [
      { label: 'الواجبات', icon: MockIcon, path: '/student/online/homework' }
    ];

    const decorated = result.current.applyBadgesToMenuItems(items);
    expect(decorated[0].badge).toBe(12);
  });

  it('5. Real-Time Socket Event: Supported homework_assigned event triggers reactive REST counter refresh', async () => {
    currentMockUser = {
      id: 'student-02',
      role: 'CENTER_STUDENT',
      institutionId: 'inst-001'
    };

    vi.mocked(homeworkService.getPendingCount)
      .mockResolvedValueOnce({ data: { pendingCount: 1 } } as any)
      .mockResolvedValueOnce({ data: { pendingCount: 2 } } as any);

    const { result } = renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      expect(result.current.counters.pendingHomework).toBe(1);
    });

    // Fire supported homework_assigned socket event from course-service
    act(() => {
      mockSocketInstance.emit('homework_assigned', {
        id: 'hw-new-1',
        courseId: 'c-1',
        updatedAt: '2026-11-11T10:00:00Z'
      });
    });

    await waitFor(() => {
      expect(result.current.counters.pendingHomework).toBe(2);
    });
  });

  it('6. Real-Time & In-Tab Lifecycle: homework_submitted socket event and ox:counters-refresh trigger REST refresh', async () => {
    currentMockUser = {
      id: 'accountant-02',
      role: 'ACCOUNTANT',
      institutionId: 'inst-001'
    };

    vi.mocked(accountingService.getExpenses)
      .mockResolvedValueOnce({
        vouchers: [{ id: 'exp-1', status: 'APPROVED' }]
      } as any)
      .mockResolvedValueOnce({
        vouchers: []
      } as any);

    const { result } = renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      expect(result.current.counters.pendingDisbursements).toBe(1);
    });

    // Accountant disbursed voucher in same tab: ox:counters-refresh triggers authoritative REST refetch
    act(() => {
      window.dispatchEvent(new Event('ox:counters-refresh'));
    });

    await waitFor(() => {
      expect(result.current.counters.pendingDisbursements).toBe(0);
    });
  });

  it('7. Event Deduplication: Ignores exact duplicate socket deliveries while allowing later state updates for the same entity ID', async () => {
    currentMockUser = {
      id: 'manager-104',
      role: 'ADMIN',
      institutionId: 'inst-001'
    };

    vi.mocked(accountingService.getExpenses).mockResolvedValue({
      vouchers: []
    } as any);

    renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      expect(accountingService.getExpenses).toHaveBeenCalledTimes(1);
    });

    // First delivery of homework_submitted event
    act(() => {
      mockSocketInstance.emit('homework_submitted', { id: 'sub-dup-1', updatedAt: '2026-11-11T10:00:00Z' });
    });

    await waitFor(() => {
      expect(accountingService.getExpenses).toHaveBeenCalledTimes(2);
    });

    // Identical duplicate delivery must be deduplicated
    act(() => {
      mockSocketInstance.emit('homework_submitted', { id: 'sub-dup-1', updatedAt: '2026-11-11T10:00:00Z' });
    });

    expect(accountingService.getExpenses).toHaveBeenCalledTimes(2);

    // Legitimate later state update with same entity ID and new updatedAt MUST NOT be suppressed
    act(() => {
      mockSocketInstance.emit('homework_submitted', { id: 'sub-dup-1', updatedAt: '2026-11-11T10:05:00Z' });
    });

    await waitFor(() => {
      expect(accountingService.getExpenses).toHaveBeenCalledTimes(3);
    });
  });

  it('8. Cross-Tenant Event Isolation: Ignores events meant for foreign institutions', async () => {
    currentMockUser = {
      id: 'manager-105',
      role: 'ADMIN',
      institutionId: 'inst-001'
    };

    vi.mocked(accountingService.getExpenses).mockResolvedValue({
      vouchers: []
    } as any);

    renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      expect(accountingService.getExpenses).toHaveBeenCalledTimes(1);
    });

    // Emit event with different institutionId
    act(() => {
      mockSocketInstance.emit('homework_submitted', {
        id: 'foreign-evt-1',
        institutionId: 'inst-999-foreign'
      });
    });

    // Call count remains 1 because foreign event is discarded
    expect(accountingService.getExpenses).toHaveBeenCalledTimes(1);
  });

  it('9. Tab Restoration / Window Focus: Revalidates counters upon returning to application tab', async () => {
    currentMockUser = {
      id: 'manager-106',
      role: 'ADMIN',
      institutionId: 'inst-001'
    };

    vi.mocked(accountingService.getExpenses).mockResolvedValue({
      vouchers: []
    } as any);

    renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      expect(accountingService.getExpenses).toHaveBeenCalledTimes(1);
    });

    // Simulate returning to tab
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(accountingService.getExpenses).toHaveBeenCalledTimes(2);
    });
  });

  it('10. Fail-Closed Resilience: Network or backend failure does not crash UI and yields safe zero counts', async () => {
    currentMockUser = {
      id: 'manager-107',
      role: 'ADMIN',
      institutionId: 'inst-001'
    };

    vi.mocked(notificationService.getUnreadCount).mockRejectedValueOnce(new Error('Network error'));
    vi.mocked(accountingService.getExpenses).mockRejectedValueOnce(new Error('500 Service Unavailable'));

    const { result } = renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      expect(result.current.counters.pendingApprovals).toBe(0);
      expect(result.current.counters.unreadNotifications).toBe(0);
      expect(result.current.loading).toBe(false);
    });
  });

  it('11. Deduplication without Version Token: Repeat events lacking a version token are NEVER suppressed by entity ID alone', async () => {
    currentMockUser = {
      id: 'student-no-ver-1',
      role: 'ONLINE_STUDENT',
      institutionId: 'inst-001'
    };

    vi.mocked(homeworkService.getPendingCount)
      .mockResolvedValueOnce({ data: { pendingCount: 1 } } as any)
      .mockResolvedValueOnce({ data: { pendingCount: 2 } } as any)
      .mockResolvedValueOnce({ data: { pendingCount: 3 } } as any);

    const { result } = renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      expect(result.current.counters.pendingHomework).toBe(1);
    });

    act(() => {
      mockSocketInstance.emit('homework_assigned', { id: 'hw-no-ver', courseId: 'c-1' });
    });

    await waitFor(() => {
      expect(result.current.counters.pendingHomework).toBe(2);
    });

    // Second delivery for same entity id without version token must still trigger a refresh
    act(() => {
      mockSocketInstance.emit('homework_assigned', { id: 'hw-no-ver', courseId: 'c-1' });
    });

    await waitFor(() => {
      expect(result.current.counters.pendingHomework).toBe(3);
    });
  });

  it('12. User Change Without Unmount: Switching User A -> User B clears stale counters and resets event deduplication cache', async () => {
    currentMockUser = {
      id: 'student-user-A',
      role: 'CENTER_STUDENT',
      institutionId: 'inst-001'
    };

    vi.mocked(homeworkService.getPendingCount)
      .mockResolvedValueOnce({ data: { pendingCount: 4 } } as any)
      .mockResolvedValueOnce({ data: { pendingCount: 5 } } as any)
      .mockResolvedValueOnce({ data: { pendingCount: 1 } } as any)
      .mockResolvedValueOnce({ data: { pendingCount: 2 } } as any);

    const { result, rerender } = renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      expect(result.current.counters.pendingHomework).toBe(4);
    });

    // User A sees evt-shared-1 with version v1
    act(() => {
      mockSocketInstance.emit('homework_assigned', { id: 'evt-shared-1', updatedAt: '2026-11-11T10:00:00Z' });
    });

    await waitFor(() => {
      expect(result.current.counters.pendingHomework).toBe(5);
    });

    // Switch authenticated user to User B without unmounting hook
    currentMockUser = {
      id: 'student-user-B',
      role: 'CENTER_STUDENT',
      institutionId: 'inst-001'
    };

    rerender();

    await waitFor(() => {
      expect(result.current.counters.pendingHomework).toBe(1);
    });

    // Same event key seen by User A must NOT be suppressed for User B
    act(() => {
      mockSocketInstance.emit('homework_assigned', { id: 'evt-shared-1', updatedAt: '2026-11-11T10:00:00Z' });
    });

    await waitFor(() => {
      expect(result.current.counters.pendingHomework).toBe(2);
    });
  });

  it('13. Socket Reconnect & Unmount Cleanup: Refetches on reconnect and unregisters socket listeners cleanly', async () => {
    currentMockUser = {
      id: 'student-reconn-1',
      role: 'ONLINE_STUDENT',
      institutionId: 'inst-001'
    };
    currentSocketConnected = false;

    vi.mocked(homeworkService.getPendingCount)
      .mockResolvedValueOnce({ data: { pendingCount: 2 } } as any)
      .mockResolvedValueOnce({ data: { pendingCount: 3 } } as any);

    const { result, rerender, unmount } = renderHook(() => useSmartNavigationCounters());

    await waitFor(() => {
      expect(result.current.counters.pendingHomework).toBe(2);
    });

    expect(mockSocketInstance.listenerCount('homework_assigned')).toBe(1);
    expect(mockSocketInstance.listenerCount('homework_submitted')).toBe(1);

    // Transition from disconnected -> connected
    currentSocketConnected = true;
    rerender();

    await waitFor(() => {
      expect(result.current.counters.pendingHomework).toBe(3);
    });

    unmount();

    expect(mockSocketInstance.listenerCount('homework_assigned')).toBe(0);
    expect(mockSocketInstance.listenerCount('homework_submitted')).toBe(0);
  });
});

