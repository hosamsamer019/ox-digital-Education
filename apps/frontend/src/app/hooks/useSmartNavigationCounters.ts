import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { notificationService } from '../services/notification.service';
import { accountingService } from '../services/accounting.service';
import { homeworkService } from '../services/homework.service';
import { MenuItem } from '../components/shared/SharedLayout';

export interface SmartCounters {
  pendingApprovals: number;
  unreadNotifications: number;
  pendingHomework: number;
  pendingDisbursements: number;
}

export function useSmartNavigationCounters() {
  const { user } = useAuth();
  const userId = user?.id;
  const userRole = user?.role;
  const userInstitutionId = user?.institutionId;
  const socketContext = useSocket();
  const socket = socketContext?.socket;
  const socketConnected = socketContext?.connected;

  const [counters, setCounters] = useState<SmartCounters>({
    pendingApprovals: 0,
    unreadNotifications: 0,
    pendingHomework: 0,
    pendingDisbursements: 0,
  });
  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  // Stale request protection
  const fetchSequenceRef = useRef<number>(0);
  // Event deduplication cache
  const handledEventIdsRef = useRef<Set<string>>(new Set());
  const prevConnectedRef = useRef<boolean>(!!socketConnected);
  const isMountedRef = useRef<boolean>(false);

  const fetchCounters = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!userId || !token) {
      setCounters({
        pendingApprovals: 0,
        unreadNotifications: 0,
        pendingHomework: 0,
        pendingDisbursements: 0,
      });
      return;
    }

    const currentSeq = ++fetchSequenceRef.current;
    const rawRole = (userRole || '').toUpperCase();
    setLoading(true);

    let unread = 0;
    let approvals = 0;
    let homework = 0;
    let disbursements = 0;
    let fetchFailed = false;

    try {
      // 1. Authoritative unread notifications count (all roles)
      if (typeof notificationService?.getUnreadCount === 'function') {
        const notifRes = await notificationService.getUnreadCount();
        if (typeof notifRes?.data?.unreadCount === 'number') {
          unread = notifRes.data.unreadCount;
        } else {
          fetchFailed = true;
        }
      }

      // 2. Role-specific authoritative counters
      if (rawRole === 'PRIMARY_MANAGER' || rawRole === 'ADMIN') {
        const expRes = await accountingService.getExpenses({ status: 'PENDING_APPROVAL' });
        const rawList = Array.isArray(expRes?.vouchers) ? expRes.vouchers : [];
        // Strict filtering: must be exact PENDING_APPROVAL and deduplicated by id
        const uniquePending = new Map<string, any>();
        rawList.forEach((v: any) => {
          if (v && v.id && v.status === 'PENDING_APPROVAL') {
            uniquePending.set(v.id, v);
          }
        });
        // Authoritative total count from backend (preserves correct totals when page limit 50 is reached)
        if (typeof expRes?.summary?.totalCount === 'number') {
          approvals = expRes.summary.totalCount;
        } else if (typeof expRes?.pagination?.total === 'number') {
          approvals = expRes.pagination.total;
        } else if (rawList.length < 50) {
          // Proven complete single page dataset
          approvals = uniquePending.size;
        } else {
          // Truncated list without authoritative total — do not present page length as complete total
          fetchFailed = true;
        }
      }

      if (rawRole === 'ACCOUNTANT') {
        // Pending actionable tasks: approved expense vouchers awaiting physical disbursement in assigned branch
        const expRes = await accountingService.getExpenses({ status: 'APPROVED' });
        const rawList = Array.isArray(expRes?.vouchers) ? expRes.vouchers : [];
        const uniqueApproved = new Map<string, any>();
        rawList.forEach((v: any) => {
          // Strictly APPROVED and not yet physically disbursed
          if (v && v.id && v.status === 'APPROVED' && !v.disbursedAt && !v.disbursedById) {
            uniqueApproved.set(v.id, v);
          }
        });
        // Authoritative total count from backend (backend enforces status=APPROVED AND disbursedAt IS NULL AND disbursedById IS NULL)
        if (typeof expRes?.summary?.totalCount === 'number') {
          disbursements = expRes.summary.totalCount;
        } else if (typeof expRes?.pagination?.total === 'number') {
          disbursements = expRes.pagination.total;
        } else if (rawList.length < 50) {
          // Proven complete single page dataset
          disbursements = uniqueApproved.size;
        } else {
          // Truncated list without authoritative total — do not present page length as complete total
          fetchFailed = true;
        }
      }

      if (rawRole === 'STUDENT' || rawRole.includes('STUDENT')) {
        // Authoritative backend student pending-homework count (no limit=10 pagination truncation)
        if (typeof (homeworkService as any)?.getPendingCount === 'function') {
          const pendingRes = await (homeworkService as any).getPendingCount();
          if (typeof pendingRes?.data?.pendingCount === 'number') {
            homework = pendingRes.data.pendingCount;
          } else {
            fetchFailed = true;
          }
        } else {
          fetchFailed = true;
        }
      }
    } catch {
      // Record fetch error state — NEVER silently represent network failure as zero
      fetchFailed = true;
    } finally {
      // Only commit if this was the latest invocation (prevents stale responses from overwriting newer state)
      if (currentSeq === fetchSequenceRef.current) {
        if (!fetchFailed) {
          setCounters({
            pendingApprovals: approvals,
            unreadNotifications: unread,
            pendingHomework: homework,
            pendingDisbursements: disbursements,
          });
          setIsError(false);
        } else {
          setIsError(true);
        }
        setLoading(false);
      }
    }
  }, [userId, userRole]);

  // Clear stale counters and event history immediately when authenticated user changes
  useEffect(() => {
    handledEventIdsRef.current.clear();
    prevConnectedRef.current = false;
    isMountedRef.current = false;
    setCounters({
      pendingApprovals: 0,
      unreadNotifications: 0,
      pendingHomework: 0,
      pendingDisbursements: 0,
    });
    setIsError(false);
  }, [userId]);

  // Initial fetch and 30s background recovery poll
  useEffect(() => {
    fetchCounters();
    const interval = setInterval(fetchCounters, 30000);
    return () => clearInterval(interval);
  }, [fetchCounters]);

  // Tab restoration, focus lifecycle & in-tab mutation sync
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchCounters();
      }
    };
    const handleFocus = () => {
      fetchCounters();
    };
    const handleLocalRefresh = () => {
      fetchCounters();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocus);
      window.addEventListener('ox:counters-refresh', handleLocalRefresh);
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('ox:counters-refresh', handleLocalRefresh);
      }
    };
  }, [fetchCounters]);

  // Real-time Socket.IO Lifecycle Integration (course-service supported producers only)
  // NOTE: Notification and accounting expense Socket.IO events (notification, new_notification,
  // notification_read, expense_created, expense_approved, expense_disbursed) are NOT emitted by
  // user-service; those counters rely on REST polling, reconnect, focus/visibility, and ox:counters-refresh.
  useEffect(() => {
    if (!socket) return;

    // Socket reconnection recovery (only fires if previously disconnected)
    if (socketConnected && !prevConnectedRef.current && isMountedRef.current) {
      fetchCounters();
    }
    prevConnectedRef.current = !!socketConnected;
    isMountedRef.current = true;

    const handleRealtimeEvent = (eventName: string, payload?: any) => {
      // Defensive client-side event filtering (authorization is enforced server-side via Socket.IO rooms & REST)
      if (payload && typeof payload === 'object') {
        if (payload.userId && userId && payload.userId !== userId) {
          return;
        }
        if (payload.institutionId && userInstitutionId && payload.institutionId !== userInstitutionId) {
          return;
        }

        // Deduplicate ONLY when a reliable event/version token exists.
        // Never suppress updates solely by eventName + payload.id when no version token is present.
        const versionToken =
          payload.eventId ??
          payload.deliveryId ??
          payload.updatedAt ??
          payload.timestamp ??
          payload.submittedAt ??
          null;
        const hasVersionToken = versionToken !== null && versionToken !== undefined && versionToken !== '';
        const eventKey = hasVersionToken
          ? payload.id
            ? `${eventName}:${payload.id}:${versionToken}`
            : `${eventName}:${versionToken}`
          : null;
        if (eventKey) {
          if (handledEventIdsRef.current.has(eventKey)) {
            return; // Exact duplicate delivery ignored
          }
          handledEventIdsRef.current.add(eventKey);
          // Rolling cache limit (keep last 100 event keys)
          if (handledEventIdsRef.current.size > 100) {
            const first = handledEventIdsRef.current.values().next().value;
            if (first) handledEventIdsRef.current.delete(first);
          }
        }
      }

      fetchCounters();
    };

    const hwAssignedHandler = (p?: any) => handleRealtimeEvent('homework_assigned', p);
    const hwSubmittedHandler = (p?: any) => handleRealtimeEvent('homework_submitted', p);

    socket.on('homework_assigned', hwAssignedHandler);
    socket.on('homework_submitted', hwSubmittedHandler);

    return () => {
      socket.off('homework_assigned', hwAssignedHandler);
      socket.off('homework_submitted', hwSubmittedHandler);
    };
  }, [socket, socketConnected, userId, userInstitutionId, fetchCounters]);

  const getBadgeForPath = useCallback(
    (path: string): number | undefined => {
      if (isError) return undefined;
      if (path.includes('/approvals')) {
        return counters.pendingApprovals > 0 ? counters.pendingApprovals : undefined;
      }
      if (path.includes('/notifications')) {
        return counters.unreadNotifications > 0 ? counters.unreadNotifications : undefined;
      }
      if (path.includes('/homework')) {
        return counters.pendingHomework > 0 ? counters.pendingHomework : undefined;
      }
      if (path.includes('/expenses')) {
        return counters.pendingDisbursements > 0 ? counters.pendingDisbursements : undefined;
      }
      return undefined;
    },
    [counters, isError]
  );

  const applyBadgesToMenuItems = useCallback(
    (items: MenuItem[]): MenuItem[] => {
      return items.map((item) => {
        const dynamicBadge = getBadgeForPath(item.path);
        if (dynamicBadge !== undefined) {
          return { ...item, badge: dynamicBadge };
        }
        if (
          item.path.includes('/approvals') ||
          item.path.includes('/notifications') ||
          item.path.includes('/homework') ||
          item.path.includes('/expenses') ||
          item.path.includes('/collections')
        ) {
          return { ...item, badge: undefined };
        }
        return item;
      });
    },
    [getBadgeForPath]
  );

  return {
    counters,
    loading,
    isError,
    refresh: fetchCounters,
    getBadgeForPath,
    applyBadgesToMenuItems,
  };
}
