import { EventEmitter } from "events";

const dashboardEvents = new EventEmitter();
dashboardEvents.setMaxListeners(0);

export function publishDashboardEvent(userId, payload) {
  if (!userId) return;
  dashboardEvents.emit(String(userId), payload);
}

export function subscribeToDashboardEvents(userId, listener) {
  const channel = String(userId);
  dashboardEvents.on(channel, listener);
  return () => dashboardEvents.off(channel, listener);
}
