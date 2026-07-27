export interface Workspace {
  id: string
  name: string
  slug: string
  is_active: boolean
  created_at: string
}

export interface WorkspaceMember {
  id: string
  user_id: string
  email: string
  username: string
  joined_at: string
}