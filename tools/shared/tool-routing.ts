// Route selection for the no-MCP runtime (ADR-0017). Every capability call is
// classified into one of four routing classes and the route that served a result
// is recorded as evidence:
//
//   live    — running Editor, reached through the optional localhost HTTP bridge
//   batch   — Unity CLI batch execution
//   offline — on-disk readers, no Editor required
//   local   — plain filesystem/process work (no Unity surface at all)
//
// The bridge is a seam only: the real localhost bridge lands in Phase 6. Nothing
// here requires a bridge to exist, and a bridge that throws is treated as absent.

export type Route = 'live' | 'batch' | 'offline' | 'local';

export interface RuntimeBridge {
  readonly kind: 'localhost-http';
  available(): boolean;
  request(path: string, body?: unknown): Promise<unknown>;
}

export interface RouteCapabilities {
  bridge?: RuntimeBridge | null;
  cliAvailable?: boolean;
  localOnly?: boolean;
}

export interface RouteSelection {
  route: Route;
  reason: string;
}

export interface RoutedResult<T> {
  route: Route;
  ok: boolean;
  value: T | null;
  error?: string;
}

function bridgeAvailable(bridge: RuntimeBridge | null | undefined): boolean {
  if (!bridge) return false;
  try {
    return bridge.available() === true;
  } catch {
    return false;
  }
}

export function selectRoute(caps: RouteCapabilities): RouteSelection {
  if (caps.localOnly) {
    return { route: 'local', reason: 'local-only capability; plain filesystem/process work' };
  }
  if (bridgeAvailable(caps.bridge)) {
    return { route: 'live', reason: 'localhost bridge available; live Editor' };
  }
  if (caps.cliAvailable) {
    return { route: 'batch', reason: 'Unity CLI available; batch execution' };
  }
  return { route: 'offline', reason: 'no bridge or CLI; on-disk readers' };
}

export function routedOk<T>(route: Route, value: T): RoutedResult<T> {
  return { route, ok: true, value };
}

export function routedError<T>(route: Route, error: string): RoutedResult<T> {
  return { route, ok: false, value: null, error };
}
