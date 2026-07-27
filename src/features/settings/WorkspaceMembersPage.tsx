import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { ArrowLeft, Send, MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TagInput } from "@/components/shared/TagInput"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getWorkspace, listWorkspaceMembers, addWorkspaceMember } from "@/lib/workspaceApi"
import type { Workspace, WorkspaceMember } from "@/types/workspace"

export function WorkspaceMembersPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [inviteEmails, setInviteEmails] = useState<string[]>([])
  const [isSending, setIsSending] = useState(false)
  const [inviteErrors, setInviteErrors] = useState<{ email: string; error: string }[]>([])

  function refetch() {
    if (!workspaceId) return
    setIsLoading(true)
    Promise.all([getWorkspace(workspaceId), listWorkspaceMembers(workspaceId)])
      .then(([ws, mem]) => {
        setWorkspace(ws)
        setMembers(mem)
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(refetch, [workspaceId])

  async function handleSendInvite() {
    if (!workspaceId || inviteEmails.length === 0) return
    setIsSending(true)
    setInviteErrors([])
    const failures: { email: string; error: string }[] = []
    for (const email of inviteEmails) {
      try {
        await addWorkspaceMember(workspaceId, email)
      } catch (err) {
        failures.push({ email, error: extractErrorMessage(err) })
      }
    }
    setInviteErrors(failures)
    setInviteEmails(failures.map((f) => f.email))
    setIsSending(false)
    refetch()
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/settings/account"
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Account Settings
        </Link>

        <h1 className="mb-6 text-2xl font-semibold text-foreground">
          {workspace?.name ?? "Workspace"} Settings
        </h1>

        <h2 className="mb-1 text-base font-semibold text-foreground">
          Members and Roles
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Invite members to this workspace by email. They need an existing
          account to join.
        </p>

        <div className="mb-8 rounded-lg border border-border p-5">
          <p className="mb-2 text-sm font-medium text-foreground">
            Invite team members
          </p>
          <div className="flex items-start gap-2">
            <TagInput
              value={inviteEmails}
              onChange={setInviteEmails}
              placeholder="name@company.com, another@company.com"
              className="flex-1"
            />
            <Button
              variant="brand"
              onClick={handleSendInvite}
              disabled={isSending || inviteEmails.length === 0}
            >
              <Send className="size-4" />
              {isSending ? "Sending…" : "Send Invite"}
            </Button>
          </div>

          {inviteErrors.length > 0 && (
            <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              <ul className="list-inside list-disc space-y-0.5">
                {inviteErrors.map((e) => (
                  <li key={e.email}>
                    {e.email} — {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <h2 className="mb-3 text-base font-semibold text-foreground">
          Team Members with Access
        </h2>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading members…</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Joined</th>
                  <th className="w-10 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-7">
                          <AvatarFallback className="bg-brand/15 text-xs text-brand">
                            {m.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{m.username}</p>
                          <p className="text-xs text-muted-foreground">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(m.joined_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded p-1 text-muted-foreground hover:bg-accent">
                          <MoreVertical className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem disabled>
                            Remove from workspace (coming soon)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const resp = (err as { response?: { data?: { detail?: unknown } } }).response
    const detail = resp?.data?.detail
    if (typeof detail === "string") return detail
  }
  return "Couldn't send invite."
}