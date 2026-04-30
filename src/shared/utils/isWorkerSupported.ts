


export const isWorkerSupported = () => {
    if (typeof window === "undefined") return false;

  const hasSupport = !!window.Worker;
  const isTestOrStorybook = 
    window.location.href.includes('iframe.html') || 
    (window as any).__VITEST__ || 
    (window as any).__JEST__;

  if (!hasSupport || isTestOrStorybook) {
    return false;
  }

  return true;
};