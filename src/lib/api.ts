import axios from "axios"

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
})

// Attach auth token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Central error handling (401 -> logout, etc.)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("auth_token")
      window.location.href = "/login"
    }
    return Promise.reject(error)
  }
)

// Toggle: set to true once backend endpoints are live for that feature.
// Individual hooks check this (or you can flip per-hook) to switch mock -> real.
export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== "false"
