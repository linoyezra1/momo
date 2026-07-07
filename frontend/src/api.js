import axios from "axios";
import { clearAdminToken, getAdminToken } from "./utils/adminAuth.js";

const api = axios.create({
  baseURL: "/api"
});

api.interceptors.request.use((config) => {
  const url = String(config.url || "");
  if (url.startsWith("/admin") && !url.startsWith("/admin/login")) {
    const token = getAdminToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = String(error.config?.url || "");
    if (error.response?.status === 401 && url.startsWith("/admin") && !url.startsWith("/admin/login")) {
      clearAdminToken();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/admin/login")) {
        window.location.assign("/admin/login");
      }
    }
    return Promise.reject(error);
  }
);

export default api;
