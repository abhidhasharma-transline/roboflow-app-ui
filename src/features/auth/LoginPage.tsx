import { useState } from "react"
import { useNavigate, useSearchParams, Link } from "react-router-dom"
import { LogoMark } from "@/components/layout/Logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { login as loginRequest } from "@/lib/authApi"
import { useAuthStore } from "@/stores/authStore"

// Dynamic image
import loginBanner from "@/assets/images/login-banner.jpg"

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const login = useAuthStore((s) => s.login)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const { user, access_token } = await loginRequest({
        email,
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
    <div className="min-h-screen grid lg:grid-cols-2">

      {/* LEFT IMAGE */}
      <div className="hidden lg:block relative">
        <img
          src={loginBanner}
          alt="Login Banner"
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-black/20" />

        <div className="absolute bottom-16 left-16 max-w-md text-white">
          <h1 className="text-4xl font-bold leading-tight">
            Welcome Back
          </h1>

          <p className="mt-4 text-lg text-white/90">
            Manage datasets, annotations and model versions from one place.
          </p>
        </div>
      </div>

      {/* RIGHT LOGIN */}
      <div className="flex items-center justify-center bg-background px-8 py-10">

        <div className="w-full max-w-md">

          <LogoMark className="mb-10 h-11 w-11" />

          <h2 className="text-3xl font-bold">
            Sign in
          </h2>

          <p className="mt-2 mb-8 text-muted-foreground">
            Welcome back! Please login to continue.
          </p>

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >

            <div>
              <Label>Email</Label>

              <Input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <Label>Password</Label>

              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-sm text-red-500">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-11"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>

          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="font-semibold text-primary hover:underline"
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

  return "Invalid email or password."
}