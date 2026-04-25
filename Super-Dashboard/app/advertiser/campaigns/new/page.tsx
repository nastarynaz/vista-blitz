"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { parseUnits } from "viem"
import { useAccount, useChainId, useSwitchChain, useWriteContract } from "wagmi"
import { waitForTransactionReceipt } from "wagmi/actions"

import { MetricChartCard } from "@/components/metric-chart-card"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { fetchJson } from "@/lib/http"
import { contractAddresses, erc20Abi, hasContractConfig, vistaEscrowAbi } from "@/lib/contracts"
import { preferenceLabels, preferenceOptions } from "@/lib/constants"
import type { CampaignRecord, PreferenceOption } from "@/lib/types"
import { buildMonadExplorerUrl, bytes32FromSeed, formatUsdc } from "@/lib/utils"
import { monadTestnet, wagmiConfig } from "@/lib/wagmi"

export default function NewCampaignPage() {
  const { address } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const [title, setTitle] = useState("")
  const [creativeUrl, setCreativeUrl] = useState("")
  const [targetUrl, setTargetUrl] = useState("")
  const [ratePerSecond, setRatePerSecond] = useState("0.000072")
  const [totalBudget, setTotalBudget] = useState("1000")
  const [ageRange, setAgeRange] = useState<[number, number]>([18, 35])
  const [locationInput, setLocationInput] = useState("Jakarta, Bandung")
  const [selectedPreferences, setSelectedPreferences] = useState<PreferenceOption[]>(["tech", "gaming"])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [launchResult, setLaunchResult] = useState<{
    txHash: string
    campaign: CampaignRecord
  } | null>(null)

  const numericRate = Number(ratePerSecond || 0)
  const ctaPreview = numericRate * 1000 * 30
  const audienceChart = [
    { date: "15", label: "At 15s", value: numericRate * 1000 * 15 },
    { date: "30", label: "At 30s", value: numericRate * 1000 * 30 },
    { date: "45", label: "At 45s", value: numericRate * 1000 * 45 },
  ]

  function togglePreference(preference: PreferenceOption) {
    setSelectedPreferences((current) =>
      current.includes(preference)
        ? current.filter((item) => item !== preference)
        : [...current, preference]
    )
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!address) return

    try {
      setIsSubmitting(true)

      const parsedBudget = Number(totalBudget)
      const parsedRate = Number(ratePerSecond)

      if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
        throw new Error("Total budget must be greater than zero.")
      }

      if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
        throw new Error("CPSv rate must be greater than zero.")
      }

      if (chainId !== monadTestnet.id) {
        await switchChainAsync({ chainId: monadTestnet.id })
      }

      const campaignIdOnchain = bytes32FromSeed(`${title}-${Date.now()}`)
      let txHash: `0x${string}` | null = null

      if (hasContractConfig && contractAddresses.mockUsdc && contractAddresses.vistaEscrow) {
        const amount = parseUnits(totalBudget, 6)

        const approvalHash = await writeContractAsync({
          abi: erc20Abi,
          address: contractAddresses.mockUsdc,
          functionName: "approve",
          args: [contractAddresses.vistaEscrow, amount],
          chainId: monadTestnet.id,
        })

        await waitForTransactionReceipt(wagmiConfig, { hash: approvalHash })

        txHash = await writeContractAsync({
          abi: vistaEscrowAbi,
          address: contractAddresses.vistaEscrow,
          functionName: "deposit",
          args: [campaignIdOnchain, amount],
          chainId: monadTestnet.id,
        })

        await waitForTransactionReceipt(wagmiConfig, { hash: txHash })
      } else {
        toast.warning("Contract addresses are not configured, so launch is running in demo mode.")
      }

      const campaign = await fetchJson<CampaignRecord>("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({
          campaignIdOnchain,
          advertiserWallet: address,
          title,
          creativeUrl,
          targetUrl,
          totalBudget: parsedBudget,
          ratePerSecond: parsedRate,
          targetPreferences: selectedPreferences,
          targetMinAge: ageRange[0],
          targetMaxAge: ageRange[1],
          targetLocations: locationInput
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      })

      setLaunchResult({ txHash: txHash ?? bytes32FromSeed(`vista-demo-launch-${Date.now()}`), campaign })
      toast.success("Campaign launched successfully.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to launch campaign.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="New campaign"
        title="Deposit budget and launch"
        description="Set your creative, CPSv rate, audience filters, and on-chain deposit in one flow."
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardContent className="p-6">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="title">Campaign title</Label>
                  <Input id="title" onChange={(event) => setTitle(event.target.value)} required value={title} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="creativeUrl">Creative URL</Label>
                  <Input
                    id="creativeUrl"
                    onChange={(event) => setCreativeUrl(event.target.value)}
                    placeholder="https://..."
                    required
                    value={creativeUrl}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="targetUrl">Target URL</Label>
                  <Input
                    id="targetUrl"
                    onChange={(event) => setTargetUrl(event.target.value)}
                    placeholder="https://..."
                    required
                    value={targetUrl}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ratePerSecond">CPSv rate</Label>
                  <Input
                    id="ratePerSecond"
                    min="0"
                    onChange={(event) => setRatePerSecond(event.target.value)}
                    step="0.000001"
                    type="number"
                    value={ratePerSecond}
                  />
                  <p className="text-sm text-muted-foreground">
                    At this rate, 1000 viewers watching 30s = ${formatUsdc(ctaPreview)}.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalBudget">Total budget</Label>
                  <Input
                    id="totalBudget"
                    min="0"
                    onChange={(event) => setTotalBudget(event.target.value)}
                    step="0.000001"
                    type="number"
                    value={totalBudget}
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-[24px] border border-border/70 bg-muted/25 p-5">
                <div>
                  <h3 className="text-base font-semibold tracking-tight">Target audience</h3>
                  <p className="text-sm text-muted-foreground">
                    Filter campaigns by preferences, age, and regions.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {preferenceOptions.map((preference) => (
                    <button
                      className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                        selectedPreferences.includes(preference)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/70 bg-background/70 text-foreground"
                      }`}
                      key={preference}
                      onClick={(event) => {
                        event.preventDefault()
                        togglePreference(preference)
                      }}
                      type="button"
                    >
                      <div className="flex items-center justify-between">
                        <span>{preferenceLabels[preference]}</span>
                        <Checkbox checked={selectedPreferences.includes(preference)} readOnly />
                      </div>
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <Label>Age range</Label>
                    <Badge variant="outline">
                      {ageRange[0]} - {ageRange[1]}
                    </Badge>
                  </div>
                  <Slider
                    max={65}
                    min={13}
                    onValueChange={(next) => {
                      const values = Array.isArray(next) ? next : [13, next]
                      setAgeRange([values[0] ?? 13, values[1] ?? values[0] ?? 65])
                    }}
                    step={1}
                    value={ageRange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="locations">Locations</Label>
                  <Input
                    id="locations"
                    onChange={(event) => setLocationInput(event.target.value)}
                    placeholder="Jakarta, Bandung, Singapore"
                    value={locationInput}
                  />
                </div>
              </div>

              <Button disabled={isSubmitting} size="lg" type="submit">
                {isSubmitting ? "Launching campaign..." : "Deposit & Launch Campaign"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <MetricChartCard
            data={audienceChart}
            description="Projected spend preview for 1000 viewers across session lengths."
            kind="bar"
            title="CPSv preview"
            valueFormatter={(value) => `${formatUsdc(value)} USDC`}
          />

          <Card>
            <CardHeader>
              <CardTitle>Launch checklist</CardTitle>
              <CardDescription>What happens when you submit this form.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>1. Generate a deterministic bytes32 campaign ID.</p>
              <p>2. Approve mUSDC spend to the VistaEscrow contract.</p>
              <p>3. Deposit budget on Monad Testnet.</p>
              <p>4. Persist campaign metadata in Supabase.</p>
              <p>5. Show transaction hash with explorer link.</p>
            </CardContent>
          </Card>

          {launchResult ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle>Campaign launched</CardTitle>
                <CardDescription>Your campaign is now available for Oracle targeting.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground">Transaction hash</p>
                  <Link
                    className="font-medium text-primary underline-offset-4 hover:underline"
                    href={buildMonadExplorerUrl("tx", launchResult.txHash)}
                    target="_blank"
                  >
                    {launchResult.txHash}
                  </Link>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    className={buttonVariants({ size: "sm" })}
                    href={`/advertiser/campaigns/${launchResult.campaign.id}`}
                  >
                    Open campaign detail
                  </Link>
                  <Link
                    className={buttonVariants({ size: "sm", variant: "outline" })}
                    href={buildMonadExplorerUrl("tx", launchResult.txHash)}
                    target="_blank"
                  >
                    View on Monad Explorer
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
