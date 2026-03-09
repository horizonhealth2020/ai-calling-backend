export const logEvent = (event: string, payload: Record<string, unknown>) => {
  console.log(JSON.stringify({ level: "info", event, payload, ts: new Date().toISOString() }));
};

export const logError = (event: string, payload: Record<string, unknown>) => {
  console.error(JSON.stringify({ level: "error", event, payload, ts: new Date().toISOString() }));
};
