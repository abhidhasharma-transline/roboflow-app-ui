import { useState } from "react"
import { Mail, Check, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { acceptInvitation, rejectInvitation } from "@/lib/workspaceApi"
import type { MyInvitation } from "@/types/workspace"

interface MyInvitationsPanelProps {
  invitations: MyInvitation[]
  onResolved: () => void
}

export function MyInvitationsPanel({ invitations, onResolved }: MyInvitationsPanelProps) {
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleAccept(invite: MyInvitation) {
    setBusyId(invite.id)
    try {
      await acceptInvitation(invite.token)
      onResolved()
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(invite: MyInvitation) {
    setBusyId(invite.id)
    try {
      await rejectInvitation(invite.token)
      onResolved()
    } finally {
      setBusyId(null)
    }
  }

  if (invitations.length === 0) return null

  return (
    <div className="mb-6 flex flex-col gap-2">
      {invitations.map((invite) => (
        <Card key={invite.id} className="border-brand/30 bg-brand/5 py-3">
          <CardContent className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
                <Mail className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  You've been invited to join{" "}
                  <span className="font-semibold">{invite.workspace_name}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Expires {new Date(invite.expires_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busyId === invite.id}
                onClick={() => handleReject(invite)}
              >
                <X className="size-3.5" />
                Decline
              </Button>
              <Button
                variant="brand"
                size="sm"
                disabled={busyId === invite.id}
                onClick={() => handleAccept(invite)}
              >
                <Check className="size-3.5" />
                Accept
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}