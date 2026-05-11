export const yieldControl = async () => {
  if ((globalThis as any).scheduler?.yield) {
    await (globalThis as any).scheduler.yield();
  } else {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
};
