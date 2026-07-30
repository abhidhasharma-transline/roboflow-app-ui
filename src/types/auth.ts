// Mirrors app/user/schema.py exactly.

export type UserRole = "super_admin" | "admin" | "labeler" | "reviewer"

export interface User {
  id: string
  email: string
  username: string
  role: UserRole
  first_name: string
  last_name: string
  avatar_url: string | null
  is_active: boolean
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  first_name: string
  last_name: string
  email: string
  username: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: User
}