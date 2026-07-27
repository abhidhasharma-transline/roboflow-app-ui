import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { LogoMark } from "@/components/layout/Logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { register, login as loginRequest } from "@/lib/authApi"
import { useAuthStore } from "@/stores/authStore"
import { motion } from "framer-motion"


export function RegisterPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
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
      await register({ email, username, password })
      const { user, access_token } = await loginRequest({ email, password })
      login(user, access_token)
      navigate("/workspace")
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4">
       <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-0 h-[500px] w-[500px] rounded-full bg-blue-300/40 blur-[120px]" />
        <div className="absolute right-[-120px] top-20 h-[450px] w-[450px] rounded-full bg-violet-400/40 blur-[120px]" />
        <div className="absolute bottom-[-120px] left-1/3 h-[450px] w-[450px] rounded-full bg-sky-300/40 blur-[120px]" />
    </div>
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <motion.div
          initial={{ opacity: 0, y: 25, scale: .96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: .5 }}
          >
      <Card className="w-full max-w-sm py-8">
        <CardContent className="p-12">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <LogoMark className="size-10" />
            <h1 className="text-lg font-semibold">Create your account</h1>
            <p className="text-sm text-muted-foreground">
              Start building and annotating datasets in minutes.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="jon doe"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" variant="brand" className="mt-1" disabled={isLoading}>
              {isLoading ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-brand hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
      </motion.div>
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
  return "Registration failed — please try again."
}