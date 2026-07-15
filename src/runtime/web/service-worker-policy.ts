const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

/** Pure policy shared by the Web runtime and the legacy PWA compatibility API. */
export function shouldRegisterStoryForgeServiceWorker(hostname: string): boolean {
  return !LOCAL_HOSTNAMES.has(hostname)
}
