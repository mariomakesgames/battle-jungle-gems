export function resolveDebugMode({ hostname = '', development = false, search = '' } = {}) {
    const local = development || hostname === 'localhost' || hostname.endsWith('.localhost') ||
        hostname === '[::1]' || hostname === '::1' || /^127(?:\.\d{1,3}){3}$/.test(hostname);
    return local && new URLSearchParams(search).get('debug') !== '0';
}

// Loopback also enables debug for a production build served by `vite preview`.
// ?debug=0 lets local tests exercise normal progression without changing saves.
export function isDebugMode() {
    return resolveDebugMode({
        hostname: globalThis.location?.hostname,
        search: globalThis.location?.search,
        development: import.meta.env?.DEV === true,
    });
}
