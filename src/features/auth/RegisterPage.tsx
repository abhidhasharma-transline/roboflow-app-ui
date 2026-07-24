import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { mockLogin } from "@/lib/mockApi"
import { useAuthStore } from "@/stores/authStore"
import { LogoMark } from "@/components/layout/Logo"



export function RegisterPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    try {
      const { user, token } = await mockLogin(email, password)
      login({ ...user, name }, token)
      navigate("/workspace")
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
              <LogoMark className="size-10" />
              <h1 className="text-lg font-semibold">Create your account</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Start building and annotating datasets in minutes.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                placeholder="Aditi Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
    </div>
  )
}
