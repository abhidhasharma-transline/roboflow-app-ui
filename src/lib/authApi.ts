import { api } from "@/lib/api"
import type { LoginRequest, RegisterRequest, TokenResponse, User } from "@/types/auth"

export async function login(payload: LoginRequest): Promise<TokenResponse> {
  const res = await api.post<TokenResponse>("/auth/login", payload)
  return res.data
}

export async function register(payload: RegisterRequest): Promise<User> {
  const res = await api.post<User>("/auth/register", payload)
  return res.data
}

/** Used to restore a session on page refresh — token is in localStorage but the store is empty. */
export async function getMe(): Promise<User> {
  const res = await api.get<User>("/auth/me")
  return res.data
}