export const yieldControl = async () => {
  if ((globalThis as any).sheduler?.yield) {
    await (globalThis as any).sheduler.yield();
  } else {
    await new Promise((r) => setTimeout(r, 0));
  }
};
