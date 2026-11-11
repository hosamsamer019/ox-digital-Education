# OX-DIGITAL Education — Final Browser & Runtime Verification Matrix

**Audit Date:** November 9, 2026  
**Audited Target:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  

---

## 1. Executive Summary

This matrix establishes the exact operational distinction between:
1. **Source-Code Inspection:** Static analysis of JavaScript/TypeScript files, JSX structures, React hooks, and lifecycle handlers.
2. **Automated Unit & Integration Tests:** Simulated DOM tests (via Vitest/Testing Library/jsdom) and Node.js backend controllers/mocks.
3. **Live Browser Runtime:** Real Chromium/WebKit/Firefox execution in an active operating system environment with running containers, network interfaces, and audio hardware.

Under the strict non-deployment boundaries governing this mission, Docker containers were not started, and live runtime networks were not modified. Consequently, this document distinguishes verified test assertions from items requiring real-browser runtime validation during the live server staging acceptance phase.

---

## 2. Browser Verification Matrix

| Area / Feature | Component / File | Source-Code Audit | Automated Unit/Integration | Real-Browser Runtime | Verification Notes & Residual Gaps |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Video Audio Teardown on Route Change** | `UnifiedVideoPlayer.tsx` | `VERIFIED` | `VERIFIED` (11/11 tests pass) | `UNVERIFIED` (Requires live browser) | In jsdom, player unmount calls `.pause()`, resets `.src`, and destroys HLS engine. Verified in `VideoPlaybackSecurityLifecycle.test.tsx`. Physical audio DAC silencing requires staging browser. |
| **HLS Media Streaming** | `UnifiedVideoPlayer.tsx` | `VERIFIED` | `VERIFIED` (31/31 tests pass) | `UNVERIFIED` (Requires live browser) | Manifest resolution, segment range headers, token propagation, and URL rewriting verified via `hls_gateway.test.ts`. Real MSE hardware playback requires live browser. |
| **Watermark Dynamic Rendering** | `UnifiedVideoPlayer.tsx` | `VERIFIED` | `VERIFIED` | `UNVERIFIED` (Requires live browser) | Dynamic student identity canvas watermark generation verified in tests; screen recording evasion requires manual browser review. |
| **Smart Notification Counters** | `useSmartNavigationCounters.ts` | `VERIFIED` | `VERIFIED` (10/10 tests pass) | `UNVERIFIED` (Requires live browser) | Deduplication, role filtering, socket event response, and tab focus recovery verified in Vitest. Multi-tab concurrency requires live staging browser. |
| **State-Aware Guidance Banner** | `ContextualGuidanceBanner.tsx` | `VERIFIED` | `VERIFIED` (15/15 tests pass) | `UNVERIFIED` (Requires live browser) | State machine transitions, role routes, blocker states, and localStorage persistence verified in `StateAwareOnboarding.test.tsx`. Live UX layout requires staging browser. |
| **Cross-Branch UI Guards** | `BranchesPage.tsx`, `CashboxPage.tsx` | `VERIFIED` | `VERIFIED` (49 assertions pass) | `UNVERIFIED` (Requires live browser) | Button disablement, restricted modal blocking, and branch switching guards verified in `CrossBranchSecurityNegative.test.tsx`. |
| **Theme & Dark Mode Persistence** | `CriticalThemeLifecycle.test.tsx` | `VERIFIED` | `VERIFIED` (15/15 tests pass) | `UNVERIFIED` (Requires live browser) | Class toggling (`dark`), CSS variable injection, and storage persistence verified in unit tests. Visual contrast audit requires live browser inspection. |
| **RTL Arabic / LTR English Layout** | `LanguageContext.tsx`, `translations.ts` | `VERIFIED` | `VERIFIED` | `UNVERIFIED` (Requires live browser) | Direction switching (`dir="rtl"`) and translation keys verified in code and tests. Physical layout flipping requires visual browser review. |

---

## 3. Checklist for Live Staging Acceptance

Once the project owner authorizes deployment to the staging server, the following 5 tests should be conducted in a real browser:
1. **Audio Teardown Verification:** Play a lecture video with sound in Google Chrome and navigate away to `/student/online/dashboard`. Verify zero audio leakage from speakers.
2. **HLS Playback Quality Switching:** Verify native Hls.js quality switching between 1080p, 720p, 480p, and 360p variants.
3. **Multi-Tab Socket Counter Sync:** Open two browser tabs (one Manager, one Accountant). In Accountant, create an expense. In Manager tab, observe approval badge increment from 0 to 1 in real time without refreshing.
4. **Contextual Guidance Transition:** As an unassigned teacher, log in and verify blocker guidance. Have Manager assign the teacher to a branch in another session; reload or receive socket event and verify guidance transitions to "Create your first course".
5. **Watermark Movement:** Verify anti-screen-recording dynamic canvas repositioning every 10 seconds across the video frame.

