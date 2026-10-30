import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { userService } from '../../services/user.service';
import { User } from '../../contexts/AuthContext';

export interface UseSelectedChildResult {
  children: User[];
  selectedChild: User | null;
  selectedChildId: string | null;
  selectChild: (childId: string) => void;
  loading: boolean;
  error: string | null;
  refetchChildren: () => Promise<void>;
}

export function useSelectedChild(): UseSelectedChildResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const [children, setChildren] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChildren = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await userService.getChildren();
      const list = Array.isArray(res) ? res : [];
      setChildren(list);
    } catch (err: any) {
      console.error('Failed to fetch parent children:', err);
      setError('تعذر تحميل بيانات الأبناء. يرجى التحقق من اتصال الشبكة.');
      setChildren([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  // Read URL query param ?child=<id>
  const urlChildId = searchParams.get('child');

  // Verify that the requested child ID belongs to the authenticated parent's children list
  const selectedChild = useMemo(() => {
    if (children.length === 0) return null;
    if (urlChildId) {
      const matched = children.find((c) => c.id === urlChildId);
      if (matched) return matched;
    }
    // Safe default to the first authorized child
    return children[0];
  }, [children, urlChildId]);

  const selectedChildId = selectedChild ? selectedChild.id : null;

  const selectChild = useCallback(
    (childId: string) => {
      // Validate that the target child belongs to authorized children list
      const exists = children.some((c) => c.id === childId);
      if (!exists) return;

      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('child', childId);
          return next;
        },
        { replace: true }
      );
    },
    [children, setSearchParams]
  );

  return {
    children,
    selectedChild,
    selectedChildId,
    selectChild,
    loading,
    error,
    refetchChildren: fetchChildren,
  };
}
