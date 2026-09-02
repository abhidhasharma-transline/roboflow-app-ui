import { useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { Mail, Check, X, CheckCircle2 } from "lucide-react"
import { LogoMark } from "@/components/layout/Logo"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/authStore"
import { listMyInvitations, acceptInvitation, rejectInvitation } from "@/lib/workspaceApi"
import { roleLabel } from "@/lib/userDisplay"
import type { MyInvitation } from "@/types/workspace"
import DetectionCanvas from "@/components/layout/DetectionCanvas"

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
    <div className="min-h-screen bg-[#09090F] grid lg:grid-cols-[1.8fr_0.9fr]">

      {/* LEFT */}
      <div className="hidden lg:block">
        <DetectionCanvas />
      </div>

      {/* RIGHT */}
      <div className="flex items-center justify-center border-l border-white/5 bg-[#111118] px-8">
        <div className="flex w-full max-w-[360px] flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2">
            <LogoMark className="h-8 w-8" />
            <span className="text-lg font-semibold tracking-tight text-white">Annomaster</span>
          </div>

          {state.kind === "loading" && (
            <p className="text-sm text-zinc-400">Loading invitation…</p>
          )}

          {state.kind === "found" && (
            <>
              <div className="flex size-11 items-center justify-center rounded-full bg-violet-600/15 text-violet-400">
                <Mail className="size-5" />
              </div>
              <div>
                <p className="font-medium text-white">
                  You've been invited to join
                </p>
                <p className="text-lg font-semibold text-white">
                  {state.invite.workspace_name}
                </p>
                <p className="mt-1.5 text-sm text-zinc-400">
                  Invited by <span className="text-zinc-200">{state.invite.invited_by_name}</span> as{" "}
                  <span className="text-zinc-200">{roleLabel(state.invite.role)}</span>
                </p>
              </div>
              <div className="flex w-full gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-white/10 bg-transparent text-white hover:bg-white/5"
                  onClick={handleReject}
                >
                  <X className="size-4" />
                  Decline
                </Button>
                <Button
                  className="flex-1 bg-violet-600 hover:bg-violet-500"
                  onClick={handleAccept}
                >
                  <Check className="size-4" />
                  Accept
                </Button>
              </div>
            </>
          )}

          {state.kind === "accepted" && (
            <>
              <CheckCircle2 className="size-10 text-emerald-500" />
              <p className="font-medium text-white">You're in!</p>
              <Button asChild className="w-full bg-violet-600 hover:bg-violet-500">
                <Link to="/workspace">Go to your workspaces</Link>
              </Button>
            </>
          )}

          {state.kind === "rejected" && (
            <>
              <p className="font-medium text-white">Invitation declined.</p>
              <Button
                asChild
                variant="outline"
                className="w-full border-white/10 bg-transparent text-white hover:bg-white/5"
              >
                <Link to="/workspace">Back to workspaces</Link>
              </Button>
            </>
          )}

          {state.kind === "not-found" && (
            <>
              <p className="font-medium text-white">
                This invitation isn't available.
              </p>
              <p className="text-sm text-zinc-400">
                It may have already been used, expired, or belongs to a
                different account than the one you're signed in with.
              </p>
              <Button
                asChild
                variant="outline"
                className="w-full border-white/10 bg-transparent text-white hover:bg-white/5"
              >
                <Link to="/workspace">Go to your workspaces</Link>
              </Button>
            </>
          )}

          {state.kind === "error" && (
            <p className="text-sm text-red-400">{state.message}</p>
          )}
        </div>
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
  return "Something went wrong — please try again."
}