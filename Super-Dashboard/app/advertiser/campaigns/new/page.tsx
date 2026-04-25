"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
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
import { locationOptions, preferenceLabels, preferenceOptions } from "@/lib/constants"
import type { CampaignRecord, PreferenceOption } from "@/lib/types"
import { buildMonadExplorerUrl, bytes32FromSeed, formatUsdc } from "@/lib/utils"
import { monadTestnet, wagmiConfig } from "@/lib/wagmi"

const VISTA_RATE = 0.000072 // USDC per viewer per second (fixed by VISTA Protocol)

type MediaType = "video" | "image" | null

function getMediaTypeFromUrl(url: string): MediaType {
  try {
    const pathname = new URL(url).pathname
    const ext = pathname.split(".").pop()?.toLowerCase() ?? ""
    if (["mp4", "webm", "mov", "avi", "mkv", "ogg"].includes(ext)) return "video"
    if (["jpg", "jpeg", "png", "gif", "webp", "svg", "avif"].includes(ext)) return "image"
  } catch {}
  return null
}

async function detectVideoDuration(url: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/detect-duration?url=${encodeURIComponent(url)}`)
    if (!res.ok) return null
    const data = await res.json()
    return typeof data.duration === "number" ? data.duration : null
  } catch {
    return null
  }
}

function MultiSelect<T extends string>({
  disabled,
  labels,
  onChange,
  options,
  placeholder,
  value,
}: {
  disabled?: boolean
  labels: Record<T, string>
  onChange: (value: T[]) => void
  options: readonly T[]
  placeholder: string
  value: T[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  function toggle(option: T) {
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option])
  }

  const displayText =
    value.length === 0
      ? placeholder
      : value.length <= 3
        ? value.map((v) => labels[v]).join(", ")
        : `${value
            .slice(0, 2)
            .map((v) => labels[v])
            .join(", ")} +${value.length - 2} more`

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <span className={value.length === 0 ? "text-muted-foreground" : ""}>{displayText}</span>
        <svg
          className={`h-4 w-4 shrink-0 opacity-50 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-background p-1 shadow-md">
          {options.map((option) => (
            <label
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
              key={option}
            >
              <Checkbox
                checked={value.includes(option)}
                onCheckedChange={() => toggle(option)}
              />
              <span>{labels[option]}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

const locationLabels = Object.fromEntries(locationOptions.map((l) => [l, l])) as Record<
  (typeof locationOptions)[number],
  string
>

export default function NewCampaignPage() {
  const { address } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()

  const [title, setTitle] = useState("")
  const [mediaUrl, setMediaUrl] = useState("")
  const [landingUrl, setLandingUrl] = useState("")
  const [mediaType, setMediaType] = useState<MediaType>(null)
  const [detectedDuration, setDetectedDuration] = useState<number | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)
  const [displayDuration, setDisplayDuration] = useState("30")
  const [totalBudget, setTotalBudget] = useState("1000")
  const [ageRange, setAgeRange] = useState<[number, number]>([18, 35])
  const [selectedPreferences, setSelectedPreferences] = useState<PreferenceOption[]>(["tech", "gaming"])
  const [selectedLocations, setSelectedLocations] = useState<(typeof locationOptions)[number][]>([
    "Jakarta",
    "Bandung",
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [launchResult, setLaunchResult] = useState<{
    txHash: string
    campaign: CampaignRecord
  } | null>(null)

  const hasMediaUrl = mediaUrl.trim().length > 0
  const duration =
    mediaType === "video" ? (detectedDuration ?? null) : Number(displayDuration) || null

  const costPer1000 = duration !== null ? VISTA_RATE * 1000 * duration : null
  const estimatedReach =
    costPer1000 && Number(totalBudget) > 0 ? Math.floor((Number(totalBudget) / costPer1000) * 1000) : null

  const audienceChart =
    duration !== null
      ? [
          { date: "25%", label: "At 25%", value: VISTA_RATE * 1000 * duration * 0.25 },
          { date: "50%", label: "At 50%", value: VISTA_RATE * 1000 * duration * 0.5 },
          { date: "75%", label: "At 75%", value: VISTA_RATE * 1000 * duration * 0.75 },
          { date: "100%", label: "Full view", value: VISTA_RATE * 1000 * duration },
        ]
      : [
          { date: "15s", label: "At 15s", value: VISTA_RATE * 1000 * 15 },
          { date: "30s", label: "At 30s", value: VISTA_RATE * 1000 * 30 },
          { date: "45s", label: "At 45s", value: VISTA_RATE * 1000 * 45 },
        ]

  async function handleMediaUrlBlur() {
    const url = mediaUrl.trim()
    if (!url) {
      setMediaType(null)
      setDetectedDuration(null)
      return
    }
    const type = getMediaTypeFromUrl(url)
    setMediaType(type)
    if (type === "video") {
      setIsDetecting(true)
      const dur = await detectVideoDuration(url)
      setDetectedDuration(dur)
      setIsDetecting(false)
      if (dur === null) {
        const isGdrive = url.includes("drive.google.com")
        toast.warning(
          isGdrive
            ? "Google Drive video detected but duration could not be read — the moov atom may be at the end of the file. Re-export with -movflags faststart, or enter the duration manually below."
            : "Could not auto-detect video duration. Enter it manually below, or re-export your video with -movflags faststart so metadata is at the start of the file.",
        )
      }
    } else {
      setDetectedDuration(null)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!address) return

    try {
      setIsSubmitting(true)

      const parsedBudget = Number(totalBudget)
      if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
        throw new Error("Total budget must be greater than zero.")
      }
      if (duration === null || duration <= 0) {
        throw new Error("Ad duration must be greater than zero.")
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

        const ratePerSecondOnchain = parseUnits(VISTA_RATE.toFixed(6), 6)

        txHash = await writeContractAsync({
          abi: vistaEscrowAbi,
          address: contractAddresses.vistaEscrow,
          functionName: "deposit",
          args: [campaignIdOnchain, amount, ratePerSecondOnchain, BigInt(duration)],
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
          creativeUrl: mediaUrl,
          targetUrl: landingUrl,
          totalBudget: parsedBudget,
          ratePerSecond: VISTA_RATE,
          targetPreferences: selectedPreferences,
          targetMinAge: ageRange[0],
          targetMaxAge: ageRange[1],
          targetLocations: selectedLocations,
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
        description="Set your creative, target audience, and on-chain deposit in one flow."
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardContent className="p-6">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="title">Campaign title</Label>
                  <Input id="title" onChange={(e) => setTitle(e.target.value)} required value={title} />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="mediaUrl">Ad media URL</Label>
                  <Input
                    id="mediaUrl"
                    onBlur={handleMediaUrlBlur}
                    onChange={(e) => {
                      setMediaUrl(e.target.value)
                      setMediaType(null)
                      setDetectedDuration(null)
                    }}
                    placeholder="https://... (.mp4, .webm, .jpg, .png, etc.)"
                    required
                    value={mediaUrl}
                  />
                  {isDetecting && (
                    <p className="text-sm text-muted-foreground">Detecting video duration…</p>
                  )}
                  {mediaType === "video" && detectedDuration !== null && (
                    <p className="text-sm text-muted-foreground">
                      Video detected — duration: <span className="font-medium text-foreground">{detectedDuration}s</span>
                    </p>
                  )}
                  {mediaType === "video" && detectedDuration === null && !isDetecting && (
                    <p className="text-sm text-muted-foreground">Video detected — enter duration manually below.</p>
                  )}
                  {mediaType === "image" && (
                    <p className="text-sm text-muted-foreground">Image detected — set display duration below.</p>
                  )}
                </div>

                {(mediaType === "image" || (mediaType === "video" && detectedDuration === null && !isDetecting)) && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="displayDuration">
                      {mediaType === "image" ? "Display duration (seconds)" : "Ad duration (seconds)"}
                    </Label>
                    <Input
                      id="displayDuration"
                      min="1"
                      onChange={(e) => setDisplayDuration(e.target.value)}
                      step="1"
                      type="number"
                      value={displayDuration}
                    />
                  </div>
                )}

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="landingUrl">Landing page URL</Label>
                  <Input
                    id="landingUrl"
                    onChange={(e) => setLandingUrl(e.target.value)}
                    placeholder="https://... (where viewers go when they click)"
                    required
                    value={landingUrl}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label>Total budget (USDC)</Label>
                  <Input
                    disabled={!hasMediaUrl}
                    min="0"
                    onChange={(e) => setTotalBudget(e.target.value)}
                    placeholder={hasMediaUrl ? "Enter budget" : "Fill in ad media URL first"}
                    step="0.000001"
                    type="number"
                    value={totalBudget}
                  />
                </div>

                <div className="sm:col-span-2 rounded-[16px] border border-border/70 bg-muted/20 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">VISTA Protocol rate</p>
                    <Badge variant="outline" className="font-mono text-xs">Fixed</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">0.000072 USDC</span> × 1,000 viewers × duration
                  </p>
                  {costPer1000 !== null ? (
                    <div className="mt-2 space-y-1 text-sm">
                      <p className="text-muted-foreground">
                        Cost for 1,000 viewers watching full ad:{" "}
                        <span className="font-semibold text-foreground">${formatUsdc(costPer1000)} USDC</span>
                      </p>
                      {estimatedReach !== null && (
                        <p className="text-primary font-medium">
                          With a ${formatUsdc(Number(totalBudget))} budget and {duration}s duration, your ad will reach approximately{" "}
                          <span className="font-semibold">{estimatedReach.toLocaleString()} viewers</span>.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Provide an ad media URL and duration to see reach estimate.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4 rounded-[24px] border border-border/70 bg-muted/25 p-5">
                <div>
                  <h3 className="text-base font-semibold tracking-tight">Target audience</h3>
                  <p className="text-sm text-muted-foreground">
                    Filter campaigns by interests, age, and regions.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Interests</Label>
                  <MultiSelect
                    labels={preferenceLabels}
                    onChange={(v) => setSelectedPreferences(v as PreferenceOption[])}
                    options={preferenceOptions}
                    placeholder="Select interests…"
                    value={selectedPreferences}
                  />
                  {selectedPreferences.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {selectedPreferences.map((p) => (
                        <Badge key={p} variant="secondary" className="text-xs">
                          {preferenceLabels[p]}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <Label>Age range</Label>
                    <Badge variant="outline">
                      {ageRange[0]} – {ageRange[1]}
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
                  <Label>Locations</Label>
                  <MultiSelect
                    labels={locationLabels}
                    onChange={(v) => setSelectedLocations(v as (typeof locationOptions)[number][])}
                    options={locationOptions}
                    placeholder="Select locations…"
                    value={selectedLocations}
                  />
                  {selectedLocations.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {selectedLocations.map((l) => (
                        <Badge key={l} variant="secondary" className="text-xs">
                          {l}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Button disabled={isSubmitting || !hasMediaUrl} size="lg" type="submit">
                {isSubmitting ? "Launching campaign…" : "Deposit & Launch Campaign"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <MetricChartCard
            data={audienceChart}
            description={
              duration !== null
                ? `Projected spend for 1,000 viewers at ${duration}s ad duration.`
                : "Projected spend preview for 1,000 viewers across session lengths."
            }
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
                    className="font-medium text-primary underline-offset-4 hover:underline break-all"
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
