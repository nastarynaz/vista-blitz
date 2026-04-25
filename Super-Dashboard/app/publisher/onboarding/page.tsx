"use client"

import { Copy, ExternalLink } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useAccount } from "wagmi"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { fetchJson } from "@/lib/http"
import type { PublisherRecord } from "@/lib/types"

export default function PublisherOnboardingPage() {
  const { address } = useAccount()
  const [platformName, setPlatformName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<PublisherRecord | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!address) return

    try {
      setIsSubmitting(true)
      const record = await fetchJson<PublisherRecord>("/api/publishers", {
        method: "POST",
        body: JSON.stringify({
          walletAddress: address,
          platformName,
        }),
      })
      setResult(record)
      toast.success("Publisher profile created.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create publisher profile.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard.")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Publisher onboarding"
        title="Activate your monetization surface"
        description="Register your platform wallet, mint an API key, and wire VISTA zones into your placement inventory."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardContent className="p-6">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="platformName">Platform name</Label>
                <Input
                  id="platformName"
                  onChange={(event) => setPlatformName(event.target.value)}
                  placeholder="MonadQuest"
                  required
                  value={platformName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="walletAddress">Wallet address</Label>
                <Input id="walletAddress" readOnly value={address ?? ""} />
              </div>
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? "Generating API key..." : "Create publisher profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {result ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle>Your API Key</CardTitle>
              <CardDescription>Keep this safe. It is shown in full only here after creation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <div className="flex items-center justify-between gap-4">
                  <code className="text-sm">{result.api_key}</code>
                  <Button onClick={() => copy(result.api_key)} size="sm" variant="outline">
                    <Copy className="size-4" />
                    Copy
                  </Button>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-sm font-medium">Integration code</p>
                <pre className="overflow-x-auto rounded-xl bg-muted/60 p-4 text-xs leading-6">
{`npm install vista-protocol

import Vista from 'vista-protocol';

Vista.init({ apiKey: '${result.api_key}' });
Vista.attachZone('your-element-id');`}
                </pre>
                <Button
                  onClick={() =>
                    copy(`npm install vista-protocol\n\nimport Vista from 'vista-protocol';\n\nVista.init({ apiKey: '${result.api_key}' });\nVista.attachZone('your-element-id');`)
                  }
                  size="sm"
                  variant="outline"
                >
                  <Copy className="size-4" />
                  Copy snippet
                </Button>
              </div>

              <Button
                onClick={() => (window.location.href = "/publisher/dashboard")}
                size="sm"
              >
                Open dashboard
                <ExternalLink className="size-4" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>What you get</CardTitle>
              <CardDescription>Once created, your publisher profile unlocks:</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>1. A unique `vista_pub_*` API key for your platform.</p>
              <p>2. Revenue analytics by campaign and timeslot.</p>
              <p>3. Realtime session visibility for active ad inventory.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
