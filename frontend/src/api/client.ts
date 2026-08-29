import axios from "axios";

export const api = axios.create({
  baseURL: "/api/v1",
});

// Attach the session token to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear the session so the route guard redirects to login.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
    }
    return Promise.reject(error);
  }
);
