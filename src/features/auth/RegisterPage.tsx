import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion } from "framer-motion"
import { LogoMark } from "@/components/layout/Logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try {
      // /auth/register only returns the created user, not a token — so we
      // log in right after with the same credentials to get one.
      await register({
        first_name: firstName,
        last_name: lastName,
        username,
        email,
        password,
      })
      const { user, access_token } = await loginRequest({ email, password })
      login(user, access_token)
      navigate("/projects")
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-[120px] -left-40 h-[600px] w-[600px] rounded-full bg-sky-300/30 blur-[160px]" />
        <div className="absolute top-[50px] -right-[180px] h-[600px] w-[600px] rounded-full bg-violet-400/30 blur-[160px]" />
        <div className="absolute bottom-[-220px] left-1/3 h-[600px] w-[600px] rounded-full bg-cyan-300/30 blur-[180px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 25, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        whileHover={{ y: -3 }}
        className="relative z-10"
      >
        <Card className="w-full max-w-md rounded-[32px] border border-white/30 bg-white/70 shadow-[0_20px_80px_rgba(0,0,0,0.12)] backdrop-blur-3xl">
          <CardContent className="p-12">
            {/* Header */}
            <div className="mb-8 flex flex-col items-center text-center">
              <LogoMark className="mb-6 h-[72px] w-[72px]" />
              <h1 className="text-3xl font-bold tracking-tight">Create Account</h1>
              <p className="mt-2 text-[15px] leading-6 text-slate-500">
                Start building computer vision datasets in minutes.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* First/Last name — its own row, separate from Username below */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first-name" className="mb-2 block">
                    First Name
                  </Label>
                  <Input
                    id="first-name"
                    className="h-12 rounded-xl border-slate-200 bg-white/80 transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                    placeholder="John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="last-name" className="mb-2 block">
                    Last Name
                  </Label>
                  <Input
                    id="last-name"
                    className="h-12 rounded-xl border-slate-200 bg-white/80 transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Username — its own row, now a proper sibling so space-y-5 applies above and below it */}
              <div>
                <Label htmlFor="username" className="mb-2 block">
                  Username
                </Label>
                <Input
                  id="username"
                  className="h-12 rounded-xl border-slate-200 bg-white/80 transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  placeholder="john_doe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="email" className="mb-2 block">
                  Work email
                </Label>
                <Input
                  id="email"
                  type="email"
                  className="h-12 rounded-xl border-slate-200 bg-white/80 transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="password" className="mb-2 block">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  className="h-12 rounded-xl border-slate-200 bg-white/80 transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button
                type="submit"
                disabled={isLoading}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-violet-700 to-violet-500 text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-violet-400/30"
              >
                {isLoading ? "Creating account..." : "Create account"}
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-violet-600 hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const resp = (err as { response?: { data?: { detail?: unknown } } }).response
    const detail = resp?.data?.detail
    if (typeof detail === "string") return detail
  }
  return "Registration failed — please try again."
}
