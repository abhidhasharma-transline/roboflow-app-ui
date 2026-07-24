export interface User {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  role: "admin" | "editor" | "annotator" | "viewer"
}

export interface AuthResponse {
  user: User
  token: string
}
