import { useState } from "react"
import { useNavigate,useSearchParams, Link } from "react-router-dom"
// import { Boxes } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { useAuthStore } from "@/stores/authStore"
import { LogoMark } from "@/components/layout/Logo"
import { FcGoogle } from "react-icons/fc"
import { login as loginRequest } from "@/lib/authApi"
import { motion } from "framer-motion"


export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchParams] = useSearchParams()


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    navigate(searchParams.get("redirect") || "/workspace")
    try {
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
    // <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
    // <div className="relative min-h-screen overflow-hidden bg-[#f6f7fb]">
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4">
       <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-0 h-[500px] w-[500px] rounded-full bg-blue-300/40 blur-[120px]" />
        <div className="absolute right-[-120px] top-20 h-[450px] w-[450px] rounded-full bg-violet-400/40 blur-[120px]" />
        <div className="absolute bottom-[-120px] left-1/3 h-[450px] w-[450px] rounded-full bg-sky-300/40 blur-[120px]" />
      </div>
      <div className="relative flex min-h-screen items-center justify-center px-4">
        {/* <Card className="w-full max-w-sm py-8"> */}
        {/* <Card className="rounded-3xl border border-white/30 bg-white/70 shadow-2xl backdrop-blur-2xl"> */}
        <motion.div
          initial={{ opacity: 0, y: 25, scale: .96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: .5 }}
          >
        <Card className="w-full max-w-md rounded-[32px] border border-white/30 bg-white/70 shadow-[0_20px_80px_rgba(0,0,0,0.12)] backdrop-blur-3xl">
          <CardContent className="p-12">
            {/* <div className="mb-6 flex flex-col items-center gap-2 text-center">
              <div className="flex size-10 items-center justify-center rounded-lg bg-brand text-brand-foreground">
                <Boxes className="size-5" />
              </div>
              <h1 className="text-lg font-semibold">Sign in to your workspace</h1>
              <LogoMark className="size-10" />
              <p className="text-sm text-muted-foreground">
                Manage datasets, annotation and model versions.
              </p>
            </div> */}
            <div className="mb-8 flex flex-col items-center">
              <LogoMark className="mb-6 h-[72px] w-[72px]" />
              <h1 className="text-3xl font-bold tracking-tight">
                  Annomaster
              </h1>
              <p className="mt-2 text-center text-[15px] leading-6 text-slate-500">
                  Build computer vision datasets faster than ever.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Work email</Label>
                <Input
                    className="h-12 rounded-xl border-slate-200 bg-white/80 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-all"
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
                <Input className="h-11 rounded-xl"
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" variant="brand" className="h-12 rounded-xl bg-gradient-to-r from-violet-700 to-violet-500 text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-violet-400/30" disabled={isLoading}>
                {isLoading ? "Signing in…" : "Sign in"}
              </Button>
              <div className="my-6 flex items-center">
                <div className="h-px flex-1 bg-border"/>
                <span className="mx-3 text-xs uppercase text-muted-foreground">
                    or
                </span>
                <div className="h-px flex-1 bg-border"/>
            </div>
              <Button
                  variant="outline"
                  className="h-12 rounded-xl border border-slate-200 bg-white font-medium transition-all hover:bg-slate-100 hover:shadow-md">
                  <FcGoogle className="mr-3 text-2xl"/>
                  Continue with Google
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link
                    to="/register"
                    className="font-semibold text-brand hover:underline">
                    Create one
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
  return "Invalid email or password."
}