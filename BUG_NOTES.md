# Bug Notes

Last updated: 2026-04-24

## Resolved

### 1) Proxy stuck in `Starting...` then timeout
- Symptoms:
  - UI stuck at `Starting...`
  - Error: `Starting proxy timed out after 7000ms`
- Root cause:
  - Startup race + stale proxy listeners/process from prior run.
  - UI timeout too short relative to backend recovery path.
- Fix:
  - Added backend forced cleanup of stale `agent-chest-proxy` on both proxy and mgmt ports before start.
  - Increased backend startup readiness window and fail-fast on child early exit.
  - Increased frontend timeout and added fallback recovery via `proxy_status` if start call times out.
- Files:
  - `src-tauri/src/proxy.rs`
  - `src/components/ProxyManager.tsx`
- Verification:
  - `cargo check` passes.
  - `npm run build` passes.

### 2) Proxy says running but stop fails / can’t reclaim ports
- Symptoms:
  - `Failed to start proxy: Proxy is already running`
  - Stop action fails to fully clear state/ports.
- Root cause:
  - Prior logic depended heavily on in-memory child handle and mgmt-port-only cleanup.
- Fix:
  - Added force cleanup path to kill tracked child and any `agent-chest-proxy` process on both `proxy_port` and `mgmt_port`.
  - `proxy_stop` now uses forced cleanup.
- Files:
  - `src-tauri/src/proxy.rs`
- Verification:
  - Added unit/integration-style test that spawns proxy on temp ports and confirms cleanup closes both listeners:
    - `proxy::tests::force_cleanup_kills_proxy_listeners`

### 3) Proxy not cleaned up when app exits
- Symptoms:
  - Close app, relaunch, ports still occupied by old proxy process.
- Root cause:
  - No app-exit lifecycle cleanup hook.
- Fix:
  - Added cleanup on Tauri run events `Exit` and `ExitRequested`.
- Files:
  - `src-tauri/src/main.rs`
- Verification:
  - Compiles and runs with new shutdown hook.

## Open / Needs Follow-up

### 4) Credential save errors when proxy mgmt API unreachable
- Symptoms:
  - `Add credential failed: Request failed: error sending request for url (http://127.0.0.1:8081/api/v1/credentials)`
- Current understanding:
  - Usually secondary to proxy process not actually healthy.
  - Might still need richer UI surfacing of mgmt health + log tail.
- Next:
  - Add explicit mgmt health indicator near credential form.
  - Add “Open proxy log” action in Proxy tab.

### 5) Buttons appear non-responsive after failed lifecycle transitions
- Symptoms:
  - Save/new actions appear to do nothing after proxy lifecycle errors.
- Current understanding:
  - Likely stale UI state from prior failed transition; partially improved with timeout/recovery.
- Next:
  - Add central “proxy operation in progress” state reset on error paths.
  - Add retry CTA with structured error details.

## Security + Stability Notes

- Cleanup only targets processes whose command line contains `agent-chest-proxy`.
- No broad `kill` by port for unrelated processes.
- Startup failures now point to proxy log path for diagnosis.

## Suggested Next QoL Improvements

1. Add “Force Reset Proxy” button:
   - Calls backend cleanup for default ports and refreshes status.
2. Add structured diagnostics panel:
   - mgmt reachable, proxy reachable, pid info, last startup error, log tail.
3. Add startup watchdog:
   - auto-retry once on stale-port failure and report exact outcome in toast.

