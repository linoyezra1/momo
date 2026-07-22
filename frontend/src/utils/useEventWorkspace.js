import { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import { isEventManagerAuthenticated } from "./eventManagerAuth.js";

/**
 * Resolves couple vs event-manager event workspace paths.
 * @returns {{
 *   userId: string,
 *   isManagerEvent: boolean,
 *   basePath: string,
 *   backPath: string,
 *   backLabel: string
 * }}
 */
export function useEventWorkspace() {
  const { userId = "" } = useParams();
  const location = useLocation();

  return useMemo(() => {
    const isManagerEvent =
      location.pathname.startsWith("/manager/events/") && isEventManagerAuthenticated();
    const basePath = isManagerEvent
      ? `/manager/events/${userId}`
      : `/client/dashboard/${userId}`;
    return {
      userId,
      isManagerEvent,
      basePath,
      backPath: isManagerEvent ? "/manager" : basePath,
      backLabel: isManagerEvent ? "חזור לרשימת הזוגות" : "חזרה לדף הראשי"
    };
  }, [location.pathname, userId]);
}
