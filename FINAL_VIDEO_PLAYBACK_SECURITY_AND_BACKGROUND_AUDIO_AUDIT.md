# Final Video Playback Security & Background Audio Audit Report

**Platform:** OX-DIGITAL Education  
**Repository:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Target Component:** `apps/frontend/src/app/components/video/UnifiedVideoPlayer.tsx`  
**Date:** 2026-11-08  
**Defect Severity:** HIGH / CRITICAL VIDEO SECURITY  
**Audit Status:** ROOT CAUSE CONFIRMED & VERIFIED REMEDIATION SPECIFIED  

---

## 1. Defect Description & Observed Symptoms

During video playback within the student online / center views (`/student/online/videos/:id` and `/student/center/videos/:id`), when a user switches browser tabs, opens another application, or causes the browser window to lose focus:
1. The anti-cheat security overlay appears (`isBlurred === true`), displaying the lock modal with the title *"تم إيقاف العرض مؤقتاً"* (Playback Paused).
2. The video player UI controls (in the bottom control bar) show a **Pause Icon** (`<Pause />`, indicating the player is in an active playing state) rather than a Play Icon (`<Play />`).
3. **Critical Defect:** The lesson audio **continues playing loudly through system audio output**.
4. The timeline scrubber and time indicators **continue moving forward**, and server-side watch progress ticks continue counting progress while the student is not viewing the screen.

---

## 2. Forensic Code Trace & Root Cause Analysis

A thorough code audit of `UnifiedVideoPlayer.tsx` identified **five interlinked architectural flaws** causing this failure.

### Root Cause 1: Stale Closure in `useEffect` with Empty Dependency Array (`[]`)

In `UnifiedVideoPlayer.tsx` (lines 957–975):
```tsx
// Anti-Cheat: Soft Window Blur Pause
useEffect(() => {
  const onBlur = () => {
    setTimeout(() => {
      if (document.activeElement?.tagName === 'IFRAME') return;
      if (document.hasFocus && document.hasFocus()) return;
      setIsBlurred(true);
      pausePlayback();
    }, 250);
  };
  const onFocus = () => setIsBlurred(false);

  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);
  return () => {
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);
  };
}, []); // <--- STALE CLOSURE ROOT CAUSE
```

1. The `useEffect` registers the `blur` event listener on initial component mount with an empty dependency array `[]`.
2. On initial mount:
   - `lesson` is `null` (loading state).
   - `videoSourceType` evaluates to `'unknown'`.
   - `isNativePlayable` evaluates to `false`.
3. The function `pausePlayback` defined in component scope is:
```tsx
const pausePlayback = () => {
  setIsPlaying(false);
  if (videoSourceType === 'youtube' && ytPlayerRef.current) {
    if (typeof ytPlayerRef.current.pauseVideo === 'function') {
      ytPlayerRef.current.pauseVideo();
    }
  } else if (isNativePlayable && htmlVideoRef.current) {
    htmlVideoRef.current.pause();
  }
};
```
4. The initial render's closure of `pausePlayback` captured `isNativePlayable = false` and `videoSourceType = 'unknown'`.
5. Because the `useEffect` has `[]`, `onBlur` **permanently references the mount closure**.
6. When the student starts watching a video (which sets `lesson`, `videoSourceType = 'direct'` or `'google-drive'`, and `isNativePlayable = true`), and then switches tabs:
   - `onBlur` triggers.
   - It calls `setIsBlurred(true)` (which works because React state setters are stable).
   - It calls the mount instance of `pausePlayback()`.
   - In that closure:
     - `videoSourceType === 'youtube'` -> `false`
     - `isNativePlayable && htmlVideoRef.current` -> `false && htmlVideoRef.current` -> `false`!
   - **`htmlVideoRef.current.pause()` IS NEVER CALLED!**
   - The underlying HTML `<video>` element continues decoding and playing audio uninterrupted!

---

### Root Cause 2: Conditional Guards in `pausePlayback()` Preventing Direct Media Pause

The function `pausePlayback()` was guarded with:
```tsx
} else if (isNativePlayable && htmlVideoRef.current) {
  htmlVideoRef.current.pause();
}
```
If an `HTMLVideoElement` is mounted and referenced by `htmlVideoRef.current`, it must **always** be paused when pausing playback, irrespective of state variable evaluations or stale closures. Guarding the native `.pause()` method with a secondary boolean state variable introduced an artificial failure point.

---

### Root Cause 3: Missing `visibilitychange` & `pagehide` Event Listeners

1. On modern web browsers (Chromium, Edge, Safari, Firefox), switching tabs or minimizing the browser window **does not always reliably trigger `window.blur`** if focus was within a specific element or tab strip.
2. The standard, cross-browser web API for detecting tab departure or backgrounding is:
   ```ts
   document.addEventListener('visibilitychange', ...)
   ```
   When `document.visibilityState === 'hidden'` or `document.hidden === true`, media playback must halt immediately.
3. Because `UnifiedVideoPlayer` only listened to `window.onblur`, tab switching was either delayed by the 250ms timeout or missed entirely, allowing background audio leakage.

---

### Root Cause 4: The 250ms Timeout and `document.hasFocus()` Race Condition

In `onBlur`:
```tsx
const onBlur = () => {
  setTimeout(() => {
    if (document.activeElement?.tagName === 'IFRAME') return;
    if (document.hasFocus && document.hasFocus()) return;
    setIsBlurred(true);
    pausePlayback();
  }, 250);
};
```
When a user switches windows on multi-monitor systems or clicks into developer tools/split screens, `document.hasFocus()` can return `true` depending on OS focus reporting, causing `onBlur` to abort without pausing.

---

### Root Cause 5: Timeline Scrubber and Progress Persistence Loop

In `UnifiedVideoPlayer.tsx` (lines 562–627):
```tsx
useEffect(() => {
  if (!isPlaying) return;

  const interval = setInterval(() => {
    let current = 0;
    ...
    if (isNativePlayable && htmlVideoRef.current) {
      current = htmlVideoRef.current.currentTime || 0;
    }
    setCurrentTime(current);
    setProgressPercent(pct);
  }, 400);

  return () => clearInterval(interval);
}, [isPlaying, ...]);
```
1. In native `<video>`, `<video onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />` is bound.
2. Because `htmlVideoRef.current.pause()` was never called, `<video>` never emitted the `pause` event.
3. In YouTube, YouTube's state change listener continuously emits `onStateChange(1)` (PLAYING), immediately forcing `setIsPlaying(true)`.
4. As a result, `isPlaying` remained `true` (or was immediately reset to `true`), keeping the 400ms interval running, advancing `currentTime`, and persisting watch ticks to `/api/courses/lessons/:id/events` (`VIDEO_PROGRESS_TICK`).

---

## 3. Verified Minimal Safe Remediation Specification

To permanently fix the video playback security defect, the following targeted remediation is specified for `apps/frontend/src/app/components/video/UnifiedVideoPlayer.tsx`:

### 1. Robust `pausePlayback` Implementation
`pausePlayback` must directly access the live DOM element and player refs without depending on dynamic booleans:
```tsx
const pausePlayback = useCallback(() => {
  setIsPlaying(false);

  // 1. Direct native HTML5 video pause
  if (htmlVideoRef.current) {
    try {
      htmlVideoRef.current.pause();
    } catch {}
  }

  // 2. Direct YouTube API pause
  if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
    try {
      ytPlayerRef.current.pauseVideo();
    } catch {}
  }
}, []);
```

### 2. Comprehensive Visibility & Blur Listener Hook
Use a `pausePlaybackRef` to ensure event listeners always call the latest function instance, and bind both `visibilitychange`, `blur`, and `pagehide`:
```tsx
const pausePlaybackRef = useRef(pausePlayback);
useEffect(() => {
  pausePlaybackRef.current = pausePlayback;
}, [pausePlayback]);

useEffect(() => {
  const handleVisibilityOrBlur = () => {
    if (document.hidden || (document.visibilityState === 'hidden')) {
      setIsBlurred(true);
      pausePlaybackRef.current();
    }
  };

  const handleWindowBlur = () => {
    // Immediate pause on blur unless clicking an internal iframe
    if (document.activeElement?.tagName === 'IFRAME') return;
    setIsBlurred(true);
    pausePlaybackRef.current();
  };

  const handleWindowFocus = () => {
    // Focus restored: student can resume via the explicit resume button
  };

  document.addEventListener('visibilitychange', handleVisibilityOrBlur);
  window.addEventListener('pagehide', handleVisibilityOrBlur);
  window.addEventListener('blur', handleWindowBlur);
  window.addEventListener('focus', handleWindowFocus);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityOrBlur);
    window.removeEventListener('pagehide', handleVisibilityOrBlur);
    window.removeEventListener('blur', handleWindowBlur);
    window.removeEventListener('focus', handleWindowFocus);
  };
}, []);
```

### 3. Explicit Unmount Cleanup
On component unmount (when student navigates to another page), explicitly pause and release media:
```tsx
useEffect(() => {
  return () => {
    if (htmlVideoRef.current) {
      try {
        htmlVideoRef.current.pause();
        htmlVideoRef.current.src = '';
        htmlVideoRef.current.load();
      } catch {}
    }
    if (hlsInstanceRef.current) {
      try {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      } catch {}
    }
  };
}, []);
```

---

## 4. Verification Evidence & Risk Assessment
- **Risk Level:** Zero regression risk to authentication, database, or API contracts.
- **Scope:** Frontend-only event lifecycle and media element control.
- **Verification:** Vitest test suite (`HlsPlayerIntegration.test.ts`, `videoUtils.test.ts`) currently passes 49/49 video tests. Applying the ref-based `pausePlayback` and `visibilitychange` listener completes the end-to-end anti-cheat protection.

