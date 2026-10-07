import axios from "axios";
import { clearAdminToken, getAdminToken } from "./utils/adminAuth.js";
import { clearAgentToken, getAgentToken } from "./utils/agentAuth.js";
import { clearEventManagerToken, getEventManagerToken } from "./utils/eventManagerAuth.js";
import { getImpersonationSession } from "./utils/impersonation.js";

const api = axios.create({
  baseURL: "/api"
});

function isAdminBroadcastsUrl(url) {
  return String(url || "").startsWith("/admin/broadcasts");
}

api.interceptors.request.use((config) => {
  const url = String(config.url || "");
  if (url.startsWith("/admin") && !url.startsWith("/admin/login")) {
    const token = getAdminToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (isAdminBroadcastsUrl(url)) {
      const impersonation = getImpersonationSession();
      if (impersonation?.token) {
        config.headers.Authorization = `Bearer ${impersonation.token}`;
      }
    }
  }
  if (url.startsWith("/agent") && !url.startsWith("/agent/login")) {
    const token = getAgentToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  if (url.startsWith("/manager") && !url.startsWith("/manager/login")) {
    const token = getEventManagerToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  if (url.startsWith("/seating-templates")) {
    const adminToken = getAdminToken();
    const managerToken = getEventManagerToken();
    if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    } else if (managerToken) {
      config.headers.Authorization = `Bearer ${managerToken}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = String(error.config?.url || "");
    if (error.response?.status === 401 && url.startsWith("/admin") && !url.startsWith("/admin/login")) {
      // Impersonation window uses broadcast APIs without admin session — don't bounce to /admin/login.
      if (isAdminBroadcastsUrl(url) && getImpersonationSession()) {
        return Promise.reject(error);
      }
      clearAdminToken();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/admin/login")) {
        window.location.assign("/admin/login");
      }
    }
    if (error.response?.status === 401 && url.startsWith("/agent") && !url.startsWith("/agent/login")) {
      clearAgentToken();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/agent/login")) {
        window.location.assign("/agent/login");
      }
    }
    if (error.response?.status === 401 && url.startsWith("/manager") && !url.startsWith("/manager/login")) {
      clearEventManagerToken();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/manager/login")) {
        window.location.assign("/manager/login");
      }
    }
    return Promise.reject(error);
  }
);

export default api;
