export interface PermissionDecision {
  origin: string;
  granted: boolean;
}

function normalizeHttpsOrigin(input: string): string {
  const url = new URL(input);
  if (url.protocol !== "https:") {
    throw new Error("Only HTTPS sources are supported.");
  }
  return `${url.origin}/*`;
}

export async function hasSourcePermission(url: string): Promise<boolean> {
  const origin = normalizeHttpsOrigin(url);
  return chrome.permissions.contains({ origins: [origin] });
}

/** Call this directly from a click or keyboard activation handler. */
export async function requestSourcePermission(
  url: string,
): Promise<PermissionDecision> {
  const origin = normalizeHttpsOrigin(url);
  const granted = await chrome.permissions.request({ origins: [origin] });
  return { origin, granted };
}

/** Request several exact provider origins in one user-gesture-bound prompt. */
export async function requestSourcePermissions(urls: readonly string[]): Promise<PermissionDecision[]> {
  const origins = [...new Set(urls.map(normalizeHttpsOrigin))];
  if (origins.length === 0) return [];
  const granted = await chrome.permissions.request({ origins });
  return origins.map((origin) => ({ origin, granted }));
}

/** Request a monitor's exact host and optional notification capability in one user gesture. */
export async function requestMonitorPermissions(url: string, notifications: boolean): Promise<boolean> {
  const origins = [normalizeHttpsOrigin(url)];
  return chrome.permissions.request({
    origins,
    ...(notifications ? { permissions: ["notifications"] } : {}),
  });
}

export async function revokeSourcePermission(url: string): Promise<boolean> {
  const origin = normalizeHttpsOrigin(url);
  return chrome.permissions.remove({ origins: [origin] });
}
