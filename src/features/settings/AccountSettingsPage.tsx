import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { LogOut, ShieldCheck, User as UserIcon, Building2, Plus } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { PageLoader } from "@/components/shared/PageLoader"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SectionHeading } from "@/components/shared/SectionHeading"
import { CreateWorkspaceDialog } from "@/components/layout/CreateWorkspaceDialog"
import { useAuthStore } from "@/stores/authStore"
import { listWorkspaces, listWorkspaceMembers } from "@/lib/workspaceApi"
import { updateMe } from "@/lib/authApi"
import { fullName, initials, roleLabel } from "@/lib/userDisplay"
import { ActivityStreakCard } from "./ActivityStreakCard"
import { ChangePasswordDialog } from "./ChangePasswordDialog"
import type { Workspace, WorkspaceMember } from "@/types/workspace"

interface WorkspaceRow {
  workspace: Workspace
  myMembership: WorkspaceMember | null
}

export function AccountSettingsPage() {
  const { user, logout, setUser } = useAuthStore()
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)

  const [workspaceRows, setWorkspaceRows] = useState<WorkspaceRow[]>([])
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true)
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false)

  const isSuperAdmin = user?.role === "super_admin"

  useEffect(() => {
    if (!user) return
    setFirstName(user.first_name)
    setLastName(user.last_name)
    setPhone(user.phone ?? "")
  }, [user])

  function refetchWorkspaces() {
    setIsLoadingWorkspaces(true)
    listWorkspaces({ mineOnly: true })
      .then(async (workspaces) => {
        const rows = await Promise.all(
          workspaces.map(async (workspace) => {
            const members = await listWorkspaceMembers(workspace.id)
            const myMembership = members.find((m) => m.user_id === user?.id) ?? null
            return { workspace, myMembership }
          })
        )
        setWorkspaceRows(rows)
      })
      .catch((err) => console.error("Workspace error:", err))
      .finally(() => setIsLoadingWorkspaces(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refetchWorkspaces, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)
    setSaveSuccess(false)
    setIsSaving(true)

    try {
      const updated = await updateMe({
        first_name: firstName,
        last_name: lastName,
        phone: phone.trim() || null,
      })
      setUser(updated)
      setSaveSuccess(true)
    } catch (err) {
      setSaveError(extractErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="w-full max-w-[1600px]">
        {isSuperAdmin && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-border bg-brand/5 px-4 py-2.5">
            <span className="flex items-center gap-2 text-sm text-foreground">
              <ShieldCheck className="size-4 text-brand" />
              You're a super admin.
            </span>
            <Link to="/settings/users" className="text-sm font-medium text-brand hover:underline">
              Manage Users
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
          {/* Left — User Details */}
          <div className="rounded-lg border border-border p-6">
            <SectionHeading icon={UserIcon}>User Details</SectionHeading>

            <div className="mb-6 flex items-center gap-4">
              <Avatar className="size-16">
                <AvatarFallback className="bg-brand/15 text-lg text-brand">
                  {user ? initials(user) : "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{user ? fullName(user) : ""}</p>
                <p className="text-xs text-muted-foreground">
                  {user && `Joined ${new Date(user.created_at).toLocaleDateString()}`}
                </p>
              </div>
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>First name</Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Last name</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Username</Label>
                  <Input value={user?.username ?? ""} disabled />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Email</Label>
                  <Input value={user?.email ?? ""} disabled />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Contact number</Label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Optional"
                />
              </div>

              {saveError && <p className="text-sm text-destructive">{saveError}</p>}
              {saveSuccess && <p className="text-sm text-green-600">Saved.</p>}

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setPasswordDialogOpen(true)}
                  className="text-sm font-medium text-brand hover:underline"
                >
                  Change Password
                </button>
                <Button type="submit" variant="brand" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>

            <div className="mt-6 border-t border-border pt-5">
              <Button variant="outline" onClick={logout}>
                <LogOut className="size-4" />
                Sign Out
              </Button>
            </div>
          </div>

          {/* Right — Activity + Workspaces, stacked */}
          <div className="flex flex-col gap-6">
            <ActivityStreakCard />

            <div className="rounded-lg border border-border p-5">
              <div className="mb-4 flex items-center justify-between">
                <SectionHeading icon={Building2}>Workspaces</SectionHeading>
                <Button variant="outline" size="sm" onClick={() => setCreateWorkspaceOpen(true)}>
                  <Plus className="size-3.5" />
                  Create Workspace
                </Button>
              </div>

              {isLoadingWorkspaces ? (
                <PageLoader />
              ) : workspaceRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No workspaces yet.</p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {workspaceRows.map(({ workspace, myMembership }) => (
                    <button
                      key={workspace.id}
                      onClick={() => navigate("/settings/workspaces")}
                      className="flex items-center justify-between gap-3 py-3 text-left first:pt-0 last:pb-0 hover:opacity-80"
                    >
                      <span className="text-sm font-medium text-foreground">{workspace.name}</span>
                      {isSuperAdmin ? (
                        <Badge variant="secondary">Super Admin</Badge>
                      ) : myMembership ? (
                        <Badge variant="secondary">{roleLabel(myMembership.role)}</Badge>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ChangePasswordDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} />
      <CreateWorkspaceDialog
        open={createWorkspaceOpen}
        onOpenChange={setCreateWorkspaceOpen}
        onCreated={refetchWorkspaces}
      />
    </div>
  )
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const resp = (err as { response?: { data?: { detail?: unknown } } }).response
    const detail = resp?.data?.detail
    if (typeof detail === "string") return detail
  }
  return "Something went wrong. Please try again."
}
