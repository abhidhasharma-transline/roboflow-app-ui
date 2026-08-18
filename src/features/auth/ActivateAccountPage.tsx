import { useState } from "react"
import { useNavigate, useParams, Link } from "react-router-dom"

import { LogoMark } from "@/components/layout/Logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import DetectionCanvas from "@/components/layout/DetectionCanvas"

import { activateAccount } from "@/lib/authApi"
import { useAuthStore } from "@/stores/authStore"

export function ActivateAccountPage() {
  const navigate = useNavigate()
  const { token } = useParams<{ token: string }>()
  const login = useAuthStore((s) => s.login)

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!token) return

    if (password !== confirmPassword) {
      setError("Passwords don't match.")
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      const { user, access_token } = await activateAccount(token, { username, password })
      login(user, access_token)
      navigate("/projects")
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#09090F] grid lg:grid-cols-[1.8fr_0.9fr]">

      {/* LEFT */}
      <div className="hidden lg:block">
        <DetectionCanvas />
      </div>

      {/* RIGHT */}
      <div className="flex items-center justify-center border-l border-white/5 bg-[#111118] px-10">

        <div className="w-full max-w-[430px]">

          <LogoMark className="mb-8 h-11 w-11" />

          <h1 className="text-3xl font-bold text-white">
            Set your password
          </h1>

          <p className="mt-2 mb-8 text-sm text-zinc-400">
            Choose a username and password to activate your account and sign in.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">

            <div className="space-y-2">
              <Label className="text-zinc-300">Username</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="john_doe"
                className="h-11 bg-[#17171F] border-white/10 text-white placeholder:text-zinc-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 5 characters"
                className="h-11 bg-[#17171F] border-white/10 text-white placeholder:text-zinc-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Confirm Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="h-11 bg-[#17171F] border-white/10 text-white placeholder:text-zinc-500"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={isLoading || !token}
              className="w-full h-11 bg-violet-600 hover:bg-violet-500"
            >
              {isLoading ? "Activating..." : "Activate Account"}
            </Button>

          </form>

          <p className="mt-8 text-center text-sm text-zinc-400">
            Already activated?{" "}
            <Link
              to="/login"
              className="font-medium text-violet-400 hover:text-violet-300"
            >
              Sign In
            </Link>
          </p>

        </div>

      </div>

    </div>
  )
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const resp = (
      err as { response?: { data?: { detail?: unknown } } }
    ).response

    const detail = resp?.data?.detail

    if (typeof detail === "string") {
      return detail
    }
  }

  return "Couldn't activate your account. The link may be invalid or expired."
}
