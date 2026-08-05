import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"

import { LogoMark } from "@/components/layout/Logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import DetectionCanvas from "@/components/layout/DetectionCanvas"

import { register, login as loginRequest } from "@/lib/authApi"
import { useAuthStore } from "@/stores/authStore"

export function RegisterPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registrationClosed, setRegistrationClosed] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    setError(null)
    setIsLoading(true)

    try {
      await register({
        first_name: firstName,
        last_name: lastName,
        username,
        email,
        password,
      })

      const { user, access_token } = await loginRequest({
        email,
        password,
      })

      login(user, access_token)

      navigate("/projects")
    } catch (err) {
      if (isRegistrationClosedError(err)) {
        setRegistrationClosed(true)
      } else {
        setError(extractErrorMessage(err))
      }
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
            Create your account
          </h1>

          <p className="mt-2 mb-8 text-sm text-zinc-400">
            Start building computer vision datasets in minutes.
          </p>

          {registrationClosed ? (
            <div className="space-y-5">
              <p className="rounded-md border border-white/10 bg-[#17171F] p-4 text-sm text-zinc-300">
                Registration is closed — ask your super admin for an account.
                You'll receive an email with a link to set your password once
                one is created for you.
              </p>
              <Link to="/login">
                <Button className="w-full h-11 bg-violet-600 hover:bg-violet-500">
                  Go to Sign In
                </Button>
              </Link>
            </div>
          ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >

            <div className="grid grid-cols-2 gap-4">

              <div className="space-y-2">
                <Label className="text-zinc-300">
                  First Name
                </Label>

                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  className="h-11 bg-[#17171F] border-white/10 text-white placeholder:text-zinc-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-300">
                  Last Name
                </Label>

                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className="h-11 bg-[#17171F] border-white/10 text-white placeholder:text-zinc-500"
                />
              </div>

            </div>

            <div className="space-y-2">

              <Label className="text-zinc-300">
                Username
              </Label>

              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="john_doe"
                className="h-11 bg-[#17171F] border-white/10 text-white placeholder:text-zinc-500"
              />

            </div>

            <div className="space-y-2">

              <Label className="text-zinc-300">
                Email
              </Label>

              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="h-11 bg-[#17171F] border-white/10 text-white placeholder:text-zinc-500"
              />

            </div>

            <div className="space-y-2">

              <Label className="text-zinc-300">
                Password
              </Label>

              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
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
              disabled={isLoading}
              className="w-full h-11 bg-violet-600 hover:bg-violet-500"
            >
              {isLoading
                ? "Creating account..."
                : "Create Account"}
            </Button>

          </form>
          )}

          {!registrationClosed && (
            <>
              <div className="relative my-8">

                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>

                <div className="relative flex justify-center">
                  <span className="bg-[#111118] px-4 text-xs text-zinc-500">
                    OR
                  </span>
                </div>

              </div>

              <Button
                variant="outline"
                className="w-full h-11 border-white/10 bg-transparent text-white hover:bg-white/5"
              >
                Continue with Google
              </Button>

              <p className="mt-8 text-center text-sm text-zinc-400">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="font-medium text-violet-400 hover:text-violet-300"
                >
                  Sign In
                </Link>
              </p>
            </>
          )}

        </div>

      </div>

    </div>
  )
}

function extractErrorMessage(err: unknown): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "response" in err
  ) {
    const resp = (
      err as {
        response?: {
          data?: {
            detail?: unknown
          }
        }
      }
    ).response

    const detail = resp?.data?.detail

    if (typeof detail === "string") {
      return detail
    }
  }

  return "Registration failed. Please try again."
}

function isRegistrationClosedError(err: unknown): boolean {
  if (typeof err !== "object" || err === null || !("response" in err)) return false
  const status = (err as { response?: { status?: number } }).response?.status
  return status === 403
}