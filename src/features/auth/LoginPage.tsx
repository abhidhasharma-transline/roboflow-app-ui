import { useState } from "react"
import { useNavigate, useSearchParams, Link } from "react-router-dom"

import { LogoMark } from "@/components/layout/Logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { login as loginRequest } from "@/lib/authApi"
import { useAuthStore } from "@/stores/authStore"
import DetectionCanvas from "@/components/layout/DetectionCanvas"

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const login = useAuthStore((s) => s.login)

  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    setError(null)
    setIsLoading(true)

    try {
      const { user, access_token } = await loginRequest({
        identifier,
        password,
      })

      login(user, access_token)

      navigate(searchParams.get("redirect") || "/projects")
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#09090F] grid lg:grid-cols-[1.8fr_0.9fr]">

      {/* LEFT SIDE */}
      <div className="hidden lg:block">
        <DetectionCanvas />
      </div>

      {/* RIGHT SIDE */}
      <div className="flex items-center justify-center border-l border-white/5 bg-[#111118] px-8">

        <div className="w-full max-w-[360px]">

          <LogoMark className="mx-auto mb-6 h-9 w-9" />

          <h1 className="text-center text-2xl font-bold text-white">
            Welcome back
          </h1>

          <p className="mt-1.5 mb-6 text-center text-xs text-zinc-400">
            Sign in to continue to your workspace.
          </p>

          <form
            onSubmit={handleSubmit}
            className="space-y-3.5"
          >

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300">
                Email or Username
              </Label>

              <Input
                type="text"
                placeholder="you@company.com or username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="
                  h-9
                  text-sm
                  bg-[#17171F]
                  border-white/10
                  text-white
                  placeholder:text-zinc-500
                  focus:border-violet-500
                "
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300">
                Password
              </Label>

              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="
                  h-9
                  text-sm
                  bg-[#17171F]
                  border-white/10
                  text-white
                  placeholder:text-zinc-500
                  focus:border-violet-500
                "
              />
            </div>

            {error && (
              <p className="text-xs text-red-400">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="
                h-9
                text-sm
                w-full
                bg-violet-600
                hover:bg-violet-500
                text-white
              "
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>

          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>

            <div className="relative flex justify-center">
              <span className="bg-[#111118] px-3 text-[11px] text-zinc-500">
                OR
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className="
              h-9
              text-sm
              w-full
              border-white/10
              bg-transparent
              text-white
              hover:bg-white/5
            "
          >
            Continue with Google
          </Button>

          <p className="mt-6 text-center text-xs text-zinc-400">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="font-medium text-violet-400 hover:text-violet-300"
            >
              Create one
            </Link>
          </p>

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

  return "Invalid email/username or password."
}