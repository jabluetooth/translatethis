import Link from "next/link";
import { AuthStatus } from "@/components/auth/auth-status";
import { HistoryPanel } from "@/components/history/history-panel";
import { TranslateWorkspace } from "@/components/translate/translate-workspace";
import { isAuthConfigured } from "@/lib/auth";

export default function Home() {
  const authEnabled = isAuthConfigured();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Technical in, plain English out</p>
          <h1 className="font-heading text-4xl font-normal tracking-tight text-balance sm:text-5xl">TranslateThis</h1>
          <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
            Paste text or drag in a file, pick an audience level and tone, and translate.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
            Pricing
          </Link>
          <AuthStatus />
        </div>
      </header>
      <TranslateWorkspace authEnabled={authEnabled} />
      {authEnabled && <HistoryPanel />}
    </main>
  );
}
