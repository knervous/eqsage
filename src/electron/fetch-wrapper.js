if (window.electronAPI) {
  // --- Hook for fetch ---
  const originalFetch = window.fetch;
  window.fetch = async (input, init) => {
    // If the URL is a string starting with /api, route through electronAPI.proxy
    if (typeof input === 'string' && input.startsWith('/api')) {
      return window.electronAPI.proxyFetch(input, init);
    }
    let newInput = input;
    // For any URL starting with /, replace with a relative path
    if (typeof input === 'string' && input.startsWith('/')) {
      newInput = `.${input}`;
    } else if (input instanceof Request && input.url.startsWith('/')) {
      newInput = new Request(`.${input.url}`, input);
    }
    return originalFetch(newInput, init);
  };
}
    