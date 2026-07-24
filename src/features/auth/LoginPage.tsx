import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Boxes } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { mockLogin } from "@/lib/mockApi"
import { useAuthStore } from "@/stores/authStore"
import { LogoMark } from "@/components/layout/Logo"


export function LoginPage() {
  const navigate = useNavigate()
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
      const { user, token } = await mockLogin(email, password)
      login(user, token)
      navigate("/workspace")
    } catch {
      setError("Invalid email or password.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm py-8">
        <CardContent>
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand text-brand-foreground">
              <Boxes className="size-5" />
            </div>
            <h1 className="text-lg font-semibold">Sign in to your workspace</h1>
            // with
            <LogoMark className="size-10" />
            <p className="text-sm text-muted-foreground">
              Manage datasets, annotation and model versions.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" variant="brand" className="mt-1" disabled={isLoading}>
              {isLoading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/register" className="font-medium text-brand hover:underline">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
