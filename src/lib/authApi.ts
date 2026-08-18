import { api } from "@/lib/api"
import type {
  ActivateAccountRequest,
  ActivityDay,
  ChangePasswordRequest,
  CreateUserRequest,
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  UpdateProfileRequest,
  User,
} from "@/types/auth"

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

/** Super admin only — provisions a new account; the user activates it via emailed link. */
export async function createUser(payload: CreateUserRequest): Promise<User> {
  const res = await api.post<User>("/auth/users", payload)
  return res.data
}

/** Super admin only. */
export async function listUsers(): Promise<User[]> {
  const res = await api.get<User[]>("/auth/users")
  return res.data
}

/** Sets the username + password on a super-admin-provisioned account and logs in. */
export async function activateAccount(
  token: string,
  payload: ActivateAccountRequest
): Promise<TokenResponse> {
  const res = await api.post<TokenResponse>(`/auth/activate/${token}`, payload)
  return res.data
}

export async function updateMe(payload: UpdateProfileRequest): Promise<User> {
  const res = await api.patch<User>("/auth/me", payload)
  return res.data
}

export async function changePassword(payload: ChangePasswordRequest): Promise<{ message: string }> {
  const res = await api.post<{ message: string }>("/auth/me/change-password", payload)
  return res.data
}

export async function getMyActivity(weeks = 12): Promise<ActivityDay[]> {
  const res = await api.get<ActivityDay[]>("/auth/me/activity", { params: { weeks } })
  return res.data
}