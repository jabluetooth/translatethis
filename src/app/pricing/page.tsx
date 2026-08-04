import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UpgradeButton } from "@/components/pricing/upgrade-button";
import { getCurrentAccount, isAuthConfigured } from "@/lib/auth";
import { ACCOUNT_FREE_TRANSLATIONS, ANONYMOUS_FREE_TRANSLATIONS, PRO_PASS_DAYS, PRO_PASS_PRICE_CENTAVOS } from "@/lib/constants";
import { isProUser } from "@/lib/db/users";
import { isPaymongoConfigured } from "@/lib/paymongo";

export const metadata = {
  title: "Pricing — TranslateThis",
};

export default async function PricingPage({ searchParams }: PageProps<"/pricing">) {
  const params = await searchParams;
  const authEnabled = isAuthConfigured();
  const paymentsEnabled = isPaymongoConfigured();
  const account = authEnabled ? await getCurrentAccount() : null;
  const isPro = account ? await isProUser(account.userId).catch(() => false) : false;
  const priceDisplay = (PRO_PASS_PRICE_CENTAVOS / 100).toLocaleString("en-PH");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Pricing</p>
        <h1 className="font-heading text-4xl font-normal tracking-tight text-balance sm:text-5xl">Simple, upfront pricing</h1>
        <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
          No subscriptions, no surprise charges — just a {PRO_PASS_DAYS}-day Pro pass when you need more than the free quota.
        </p>
      </header>

      {params.success === "true" && (
        <div className="rounded-lg border border-emerald-600/30 bg-emerald-600/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
          Payment received — Pro is now active.
        </div>
      )}
      {params.canceled === "true" && <div className="rounded-lg border p-3 text-sm text-muted-foreground">Checkout canceled — no charge was made.</div>}

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-4">
            <div>
              <h2 className="font-heading text-2xl">Free</h2>
              <p className="text-sm text-muted-foreground">For trying it out</p>
            </div>
            <p className="font-heading text-3xl">₱0</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>{ACCOUNT_FREE_TRANSLATIONS} translations/month, signed in</li>
              <li>{ANONYMOUS_FREE_TRANSLATIONS}/day without an account</li>
              <li>All jargon levels &amp; tones</li>
            </ul>
            {!isPro && (
              <Badge variant="secondary" className="font-normal">
                Current plan
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <div>
              <h2 className="font-heading text-2xl">Pro</h2>
              <p className="text-sm text-muted-foreground">{PRO_PASS_DAYS}-day pass</p>
            </div>
            <p className="font-heading text-3xl">
              ₱{priceDisplay}
              <span className="font-sans text-base font-normal text-muted-foreground"> / {PRO_PASS_DAYS} days</span>
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>Unlimited translations</li>
              <li>Saved translation history</li>
              <li>Everything in Free</li>
            </ul>

            {!paymentsEnabled ? (
              <Badge variant="secondary" className="font-normal">
                Coming soon
              </Badge>
            ) : isPro ? (
              <Badge className="font-normal">Active</Badge>
            ) : !authEnabled ? (
              <Button disabled className="w-full">
                Sign-in not configured
              </Button>
            ) : account ? (
              <UpgradeButton />
            ) : (
              <Link href="/" className={buttonVariants({ className: "w-full" })}>
                Sign in to upgrade
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        {paymentsEnabled
          ? `Pro is a one-time ${PRO_PASS_DAYS}-day pass, not an auto-renewing subscription — buy again anytime, and buying early just extends your remaining time rather than resetting it.`
          : "Pro isn't purchasable yet — the free, signed-in tier is fully available in the meantime."}
      </p>
    </main>
  );
}
