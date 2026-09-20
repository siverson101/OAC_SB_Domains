// Route selection for the Unity CLI runtime.
//
// The in-editor Unity MCP (AI assistant package) is deprecated and is NOT used.
// The live Editor is reached through the Unity CLI, which drives the Pipeline
// package's local server:
//
//   live    — running Editor, reached via the Unity CLI live channel:
//             `unity command` / `unity eval` (transport `cli`, preferred) or the
//             CLI's stdio MCP server `unity mcp` (transport `mcp`, when shell
//             execution is not viable). No custom localhost HTTP bridge is built.
//   batch   — Unity CLI batch execution (`unity test`, builds)
//   offline — on-disk readers, no Editor required
//   local   — plain filesystem/process work (no Unity surface at all)
//
// The live channel is a seam: the concrete `cli`/`mcp` transports are wired by
// later phases. Nothing here requires a channel to exist, and a channel that
// throws is treated as absent (fail-soft).

export type Route = 'live' | 'batch' | 'offline' | 'local';

export type LiveTransport = 'cli' | 'mcp';

export interface LiveEditorChannel {
  transport: LiveTransport;
  available(): boolean;
}

export interface RouteCapabilities {
  live?: LiveEditorChannel | null;
  cliAvailable?: boolean;
  localOnly?: boolean;
}

export interface RouteSelection {
  route: Route;
  reason: string;
  transport?: LiveTransport;
}

export interface RoutedResult<T> {
  route: Route;
  ok: boolean;
  value: T | null;
  error?: string;
}

function liveAvailable(channel: LiveEditorChannel | null | undefined): boolean {
  if (!channel) return false;
  try {
    return channel.available() === true;
  } catch {
    return false;
  }
}

export function selectRoute(caps: RouteCapabilities): RouteSelection {
  if (caps.localOnly) {
    return { route: 'local', reason: 'local-only capability; plain filesystem/process work' };
  }
  if (liveAvailable(caps.live) && caps.live) {
    return {
      route: 'live',
      reason: `Unity CLI ${caps.live.transport} channel available; live Editor`,
      transport: caps.live.transport,
    };
  }
  if (caps.cliAvailable) {
    return { route: 'batch', reason: 'Unity CLI available; batch execution' };
  }
  return { route: 'offline', reason: 'no Unity CLI live channel; on-disk readers' };
}

export function routedOk<T>(route: Route, value: T): RoutedResult<T> {
  return { route, ok: true, value };
}

export function routedError<T>(route: Route, error: string): RoutedResult<T> {
  return { route, ok: false, value: null, error };
}
