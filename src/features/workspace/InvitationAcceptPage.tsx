import { useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { Mail, Check, X, CheckCircle2 } from "lucide-react"
import { LogoMark } from "@/components/layout/Logo"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/authStore"
import { listMyInvitations, acceptInvitation, rejectInvitation } from "@/lib/workspaceApi"
import type { MyInvitation } from "@/types/workspace"

type ViewState =
  | { kind: "loading" }
  | { kind: "found"; invite: MyInvitation }
  | { kind: "not-found" }
  | { kind: "accepted" }
  | { kind: "rejected" }
  | { kind: "error"; message: string }

export function InvitationAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, isHydrating, hydrate } = useAuthStore()
  const [state, setState] = useState<ViewState>({ kind: "loading" })

  useEffect(() => {
    hydrate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isHydrating || !token) return
    if (!isAuthenticated) {
      navigate(`/login?redirect=/workspace/invitations/${token}`, { replace: true })
      return
    }
    listMyInvitations()
      .then((invites) => {
        const invite = invites.find((i) => i.token === token)
        setState(invite ? { kind: "found", invite } : { kind: "not-found" })
      })
      .catch(() => setState({ kind: "error", message: "Couldn't load this invitation." }))
  }, [isHydrating, isAuthenticated, token, navigate])

  async function handleAccept() {
    if (!token) return
    try {
      await acceptInvitation(token)
      setState({ kind: "accepted" })
    } catch (err) {
      setState({ kind: "error", message: extractErrorMessage(err) })
    }
  }

  async function handleReject() {
    if (!token) return
    try {
      await rejectInvitation(token)
      setState({ kind: "rejected" })
    } catch (err) {
      setState({ kind: "error", message: extractErrorMessage(err) })
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm py-8">
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <LogoMark className="size-10" />

          {state.kind === "loading" && (
            <p className="text-sm text-muted-foreground">Loading invitation…</p>
          )}

          {state.kind === "found" && (
            <>
              <div className="flex size-11 items-center justify-center rounded-full bg-brand/15 text-brand">
                <Mail className="size-5" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  You've been invited to join
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {state.invite.workspace_name}
                </p>
              </div>
              <div className="flex w-full gap-2">
                <Button variant="outline" className="flex-1" onClick={handleReject}>
                  <X className="size-4" />
                  Decline
                </Button>
                <Button variant="brand" className="flex-1" onClick={handleAccept}>
                  <Check className="size-4" />
                  Accept
                </Button>
              </div>
            </>
          )}

          {state.kind === "accepted" && (
            <>
              <CheckCircle2 className="size-10 text-emerald-600" />
              <p className="font-medium text-foreground">You're in!</p>
              <Button variant="brand" asChild className="w-full">
                <Link to="/workspace">Go to your workspaces</Link>
              </Button>
            </>
          )}

          {state.kind === "rejected" && (
            <>
              <p className="font-medium text-foreground">Invitation declined.</p>
              <Button variant="outline" asChild className="w-full">
                <Link to="/workspace">Back to workspaces</Link>
              </Button>
            </>
          )}

          {state.kind === "not-found" && (
            <>
              <p className="font-medium text-foreground">
                This invitation isn't available.
              </p>
              <p className="text-sm text-muted-foreground">
                It may have already been used, expired, or belongs to a
                different account than the one you're signed in with.
              </p>
              <Button variant="outline" asChild className="w-full">
                <Link to="/workspace">Go to your workspaces</Link>
              </Button>
            </>
          )}

          {state.kind === "error" && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const resp = (err as { response?: { data?: { detail?: unknown } } }).response
    const detail = resp?.data?.detail
    if (typeof detail === "string") return detail
  }
  return "Something went wrong — please try again."
}