import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — NetCollect" },
      { name: "description", content: "Sign in to manage ISP bill collection." },
      { property: "og:title", content: "Sign in — NetCollect" },
      { property: "og:description", content: "Sign in to manage ISP bill collection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return toast.error(error.message);
      navigate({ to: "/" });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      setBusy(false);
      if (error) return toast.error(error.message);
      if (data.session) navigate({ to: "/" });
      else setSent(true);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) return toast.error(r.error.message ?? "Google sign-in failed");
    if (r.redirected) return;
    navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 glass">
        <div className="mb-6 flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground"><Wifi className="size-5" /></div>
          <div>
            <h1 className="text-lg font-bold leading-tight">NetCollect</h1>
            <p className="text-xs text-muted-foreground">Bill collection for your service area</p>
          </div>
        </div>
        {sent ? (
          <p className="text-sm">Check <b>{email}</b> for a confirmation link, then sign in.</p>
        ) : (
          <>
            <form onSubmit={submit} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pw">Password</Label>
                <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" size="lg" disabled={busy}>{mode === "in" ? "Sign in" : "Create account"}</Button>
            </form>
            <Button variant="outline" size="lg" className="mt-3 w-full" onClick={google}>Continue with Google</Button>
            <button className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "New staff member? Create an account" : "Have an account? Sign in"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
