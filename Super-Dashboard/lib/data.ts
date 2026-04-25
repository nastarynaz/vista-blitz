import { roleMeta } from "@/lib/constants"
import { mockDb } from "@/lib/mock-data"
import { createServerSupabaseClient } from "@/lib/supabase"
import type {
  ActiveCampaignResult,
  AdvertiserDashboardData,
  AdvertiserRecord,
  CampaignDetailData,
  CampaignListItem,
  CampaignRecord,
  ChartPoint,
  OracleReceiptPayload,
  OracleTickPayload,
  PreferenceOption,
  PublisherAnalyticsData,
  PublisherDashboardData,
  PublisherRecord,
  ReceiptRecord,
  RegistrationStatus,
  RoleName,
  SessionListItem,
  SessionRecord,
  StreamTickRecord,
  UserDashboardData,
  UserHistoryData,
  UserRecord,
} from "@/lib/types"
import {
  average,
  buildMonadExplorerUrl,
  buildVistaPublisherApiKey,
  dayKey,
  formatDateShort,
  formatHourLabel,
  normalizeWallet,
  safeNumber,
  sumNumbers,
} from "@/lib/utils"

type RoleRecord = AdvertiserRecord | PublisherRecord | UserRecord

const nowIso = () => new Date().toISOString()

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function getRoleCollection(role: RoleName) {
  if (role === "user") return mockDb.users
  if (role === "publisher") return mockDb.publishers
  return mockDb.advertisers
}

function normalizeCampaign(row: Record<string, unknown>): CampaignRecord {
  return {
    id: String(row.id),
    campaign_id_onchain: String(row.campaign_id_onchain),
    advertiser_wallet: normalizeWallet(String(row.advertiser_wallet)),
    title: String(row.title),
    creative_url: String(row.creative_url),
    target_url: String(row.target_url),
    total_budget: safeNumber(row.total_budget as string | number),
    remaining_budget: safeNumber(row.remaining_budget as string | number),
    rate_per_second: safeNumber(row.rate_per_second as string | number),
    target_preferences: (row.target_preferences as PreferenceOption[] | null) ?? null,
    target_min_age: row.target_min_age == null ? null : Number(row.target_min_age),
    target_max_age: row.target_max_age == null ? null : Number(row.target_max_age),
    target_locations: (row.target_locations as string[] | null) ?? null,
    active: Boolean(row.active),
    created_at: String(row.created_at),
  }
}

function normalizeSession(row: Record<string, unknown>): SessionRecord {
  return {
    id: String(row.id),
    session_id_onchain: String(row.session_id_onchain),
    campaign_id_onchain: String(row.campaign_id_onchain),
    user_wallet: normalizeWallet(String(row.user_wallet)),
    publisher_wallet: normalizeWallet(String(row.publisher_wallet)),
    seconds_verified: Number(row.seconds_verified ?? 0),
    total_paid_usdc: safeNumber(row.total_paid_usdc as string | number),
    active: Boolean(row.active),
    started_at: String(row.started_at),
    ended_at: row.ended_at ? String(row.ended_at) : null,
  }
}

function normalizeTick(row: Record<string, unknown>): StreamTickRecord {
  return {
    id: String(row.id),
    session_id_onchain: String(row.session_id_onchain),
    user_wallet: normalizeWallet(String(row.user_wallet)),
    publisher_wallet: normalizeWallet(String(row.publisher_wallet)),
    user_amount: safeNumber(row.user_amount as string | number),
    publisher_amount: safeNumber(row.publisher_amount as string | number),
    total_amount: safeNumber(row.total_amount as string | number),
    seconds_elapsed: Number(row.seconds_elapsed ?? 0),
    block_timestamp: String(row.block_timestamp),
    created_at: String(row.created_at),
  }
}

function normalizeReceipt(row: Record<string, unknown>): ReceiptRecord {
  return {
    id: String(row.id),
    token_id: String(row.token_id),
    session_id_onchain: String(row.session_id_onchain),
    user_wallet: normalizeWallet(String(row.user_wallet)),
    advertiser_wallet: normalizeWallet(String(row.advertiser_wallet)),
    campaign_id_onchain: String(row.campaign_id_onchain),
    seconds_verified: Number(row.seconds_verified ?? 0),
    usdc_paid: safeNumber(row.usdc_paid as string | number),
    minted_at: String(row.minted_at),
  }
}

function toCampaignListItem(campaign: CampaignRecord, sessions: SessionRecord[]): CampaignListItem {
  const matchingSessions = sessions.filter(
    (session) => session.campaign_id_onchain === campaign.campaign_id_onchain
  )

  return {
    id: campaign.id,
    campaignIdOnchain: campaign.campaign_id_onchain,
    title: campaign.title,
    status: campaign.active ? "active" : "ended",
    totalBudget: campaign.total_budget,
    remainingBudget: campaign.remaining_budget,
    totalViewers: matchingSessions.length,
    totalSecondsVerified: sumNumbers(matchingSessions.map((session) => session.seconds_verified)),
    totalUsdcSpent: sumNumbers(matchingSessions.map((session) => session.total_paid_usdc)),
    createdAt: campaign.created_at,
  }
}

function toSessionListItem(
  session: SessionRecord,
  campaigns: CampaignRecord[],
  ticks: StreamTickRecord[]
): SessionListItem {
  const matchingCampaign = campaigns.find(
    (campaign) => campaign.campaign_id_onchain === session.campaign_id_onchain
  )
  const matchingTicks = ticks.filter((tick) => tick.session_id_onchain === session.session_id_onchain)

  return {
    id: session.id,
    sessionIdOnchain: session.session_id_onchain,
    campaignIdOnchain: session.campaign_id_onchain,
    campaignTitle: matchingCampaign?.title,
    userWallet: session.user_wallet,
    publisherWallet: session.publisher_wallet,
    secondsVerified: session.seconds_verified,
    usdcPaid: session.total_paid_usdc,
    publisherAmount: sumNumbers(matchingTicks.map((tick) => tick.publisher_amount)),
    startedAt: session.started_at,
    endedAt: session.ended_at,
    status: session.active ? "active" : "ended",
  }
}

function buildDaySeries(values: Array<{ date: string; value: number; secondaryValue?: number }>): ChartPoint[] {
  const grouped = new Map<string, { value: number; secondaryValue: number }>()

  for (const entry of values) {
    const key = dayKey(entry.date)
    const current = grouped.get(key) ?? { value: 0, secondaryValue: 0 }
    current.value += entry.value
    current.secondaryValue += entry.secondaryValue ?? 0
    grouped.set(key, current)
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, summary]) => ({
      date,
      label: formatDateShort(date),
      value: summary.value,
      secondaryValue: summary.secondaryValue || undefined,
    }))
}

function campaignMatchesUser(campaign: CampaignRecord, user: UserRecord | null) {
  if (!user) return true

  const userPreferences = user.preferences ?? []
  const userLocation = user.location?.toLowerCase()
  const hasPreferenceTarget =
    Array.isArray(campaign.target_preferences) && campaign.target_preferences.length > 0
  const hasLocationTarget =
    Array.isArray(campaign.target_locations) && campaign.target_locations.length > 0

  const matchesPreferences = !hasPreferenceTarget
    ? true
    : campaign.target_preferences!.some((preference) => userPreferences.includes(preference))

  const matchesLocation = !hasLocationTarget
    ? true
    : campaign.target_locations!.some((location) => location.toLowerCase() === userLocation)

  const matchesAge =
    user.age == null
      ? true
      : (campaign.target_min_age == null || user.age >= campaign.target_min_age) &&
        (campaign.target_max_age == null || user.age <= campaign.target_max_age)

  return matchesPreferences && matchesLocation && matchesAge
}

async function selectRoleRecord<T extends RoleRecord>(role: RoleName, wallet: string): Promise<T | null> {
  const normalizedWallet = normalizeWallet(wallet)
  const supabase = createServerSupabaseClient()

  if (!supabase) {
    const record = getRoleCollection(role).find(
      (item) => normalizeWallet((item as UserRecord | PublisherRecord | AdvertiserRecord).wallet_address) === normalizedWallet
    )
    return clone((record as T | undefined) ?? null)
  }

  const table = role === "user" ? "users" : role === "publisher" ? "publishers" : "advertisers"
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("wallet_address", normalizedWallet)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return (data as T | null) ?? null
}

async function selectCampaignsByWallet(wallet: string) {
  const normalizedWallet = normalizeWallet(wallet)
  const supabase = createServerSupabaseClient()

  if (!supabase) {
    return clone(
      mockDb.campaigns.filter((campaign) => normalizeWallet(campaign.advertiser_wallet) === normalizedWallet)
    )
  }

  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("advertiser_wallet", normalizedWallet)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => normalizeCampaign(row as Record<string, unknown>))
}

async function selectCampaignById(id: string) {
  const supabase = createServerSupabaseClient()

  if (!supabase) {
    const campaign = mockDb.campaigns.find(
      (item) => item.id === id || item.campaign_id_onchain === id
    )
    return clone(campaign ?? null)
  }

  const direct = await supabase.from("campaigns").select("*").eq("id", id).maybeSingle()
  if (direct.error) {
    throw new Error(direct.error.message)
  }
  if (direct.data) {
    return normalizeCampaign(direct.data as Record<string, unknown>)
  }

  const onchain = await supabase
    .from("campaigns")
    .select("*")
    .eq("campaign_id_onchain", id)
    .maybeSingle()

  if (onchain.error) {
    throw new Error(onchain.error.message)
  }

  return onchain.data ? normalizeCampaign(onchain.data as Record<string, unknown>) : null
}

async function selectSessions(filters?: {
  campaignIds?: string[]
  campaignIdOnchain?: string
  publisherWallet?: string
  userWallet?: string
}) {
  const supabase = createServerSupabaseClient()

  if (!supabase) {
    let sessions = [...mockDb.sessions]

    if (filters?.campaignIds?.length) {
      sessions = sessions.filter((session) => filters.campaignIds!.includes(session.campaign_id_onchain))
    }

    if (filters?.campaignIdOnchain) {
      sessions = sessions.filter((session) => session.campaign_id_onchain === filters.campaignIdOnchain)
    }

    if (filters?.publisherWallet) {
      sessions = sessions.filter(
        (session) => normalizeWallet(session.publisher_wallet) === normalizeWallet(filters.publisherWallet)
      )
    }

    if (filters?.userWallet) {
      sessions = sessions.filter(
        (session) => normalizeWallet(session.user_wallet) === normalizeWallet(filters.userWallet)
      )
    }

    return clone(sessions.sort((a, b) => b.started_at.localeCompare(a.started_at)))
  }

  let query = supabase.from("sessions").select("*").order("started_at", { ascending: false })

  if (filters?.campaignIds?.length) {
    query = query.in("campaign_id_onchain", filters.campaignIds)
  }

  if (filters?.campaignIdOnchain) {
    query = query.eq("campaign_id_onchain", filters.campaignIdOnchain)
  }

  if (filters?.publisherWallet) {
    query = query.eq("publisher_wallet", normalizeWallet(filters.publisherWallet))
  }

  if (filters?.userWallet) {
    query = query.eq("user_wallet", normalizeWallet(filters.userWallet))
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => normalizeSession(row as Record<string, unknown>))
}

async function selectTicks(filters?: {
  publisherWallet?: string
  userWallet?: string
  sessionIds?: string[]
}) {
  const supabase = createServerSupabaseClient()

  if (!supabase) {
    let ticks = [...mockDb.streamTicks]

    if (filters?.publisherWallet) {
      ticks = ticks.filter(
        (tick) => normalizeWallet(tick.publisher_wallet) === normalizeWallet(filters.publisherWallet)
      )
    }

    if (filters?.userWallet) {
      ticks = ticks.filter((tick) => normalizeWallet(tick.user_wallet) === normalizeWallet(filters.userWallet))
    }

    if (filters?.sessionIds?.length) {
      ticks = ticks.filter((tick) => filters.sessionIds!.includes(tick.session_id_onchain))
    }

    return clone(ticks.sort((a, b) => b.block_timestamp.localeCompare(a.block_timestamp)))
  }

  let query = supabase
    .from("stream_ticks")
    .select("*")
    .order("block_timestamp", { ascending: false })

  if (filters?.publisherWallet) {
    query = query.eq("publisher_wallet", normalizeWallet(filters.publisherWallet))
  }

  if (filters?.userWallet) {
    query = query.eq("user_wallet", normalizeWallet(filters.userWallet))
  }

  if (filters?.sessionIds?.length) {
    query = query.in("session_id_onchain", filters.sessionIds)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => normalizeTick(row as Record<string, unknown>))
}

async function selectReceipts(userWallet?: string) {
  const supabase = createServerSupabaseClient()

  if (!supabase) {
    const receipts = userWallet
      ? mockDb.receipts.filter(
          (receipt) => normalizeWallet(receipt.user_wallet) === normalizeWallet(userWallet)
        )
      : mockDb.receipts

    return clone(receipts.sort((a, b) => b.minted_at.localeCompare(a.minted_at)))
  }

  let query = supabase.from("receipts").select("*").order("minted_at", { ascending: false })

  if (userWallet) {
    query = query.eq("user_wallet", normalizeWallet(userWallet))
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => normalizeReceipt(row as Record<string, unknown>))
}

export async function getRegistrationStatus(
  role: RoleName,
  wallet: string
): Promise<RegistrationStatus<UserRecord | PublisherRecord | AdvertiserRecord>> {
  const record = await selectRoleRecord(role, wallet)

  return {
    registered: Boolean(record),
    role,
    record,
  }
}

export async function createUser(input: {
  walletAddress: string
  age: number | null
  location: string | null
  preferences: PreferenceOption[]
}) {
  const normalizedWallet = normalizeWallet(input.walletAddress)
  const payload: UserRecord = {
    wallet_address: normalizedWallet,
    age: input.age,
    location: input.location?.trim() || null,
    preferences: input.preferences.length ? input.preferences : null,
    created_at: nowIso(),
  }
  const supabase = createServerSupabaseClient()

  if (!supabase) {
    const existingIndex = mockDb.users.findIndex((item) => item.wallet_address === normalizedWallet)

    if (existingIndex >= 0) {
      mockDb.users[existingIndex] = payload
    } else {
      mockDb.users.unshift(payload)
    }

    return clone(payload)
  }

  const { data, error } = await supabase
    .from("users")
    .upsert(payload, { onConflict: "wallet_address" })
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as UserRecord
}

export async function getUser(wallet: string) {
  return selectRoleRecord<UserRecord>("user", wallet)
}

export async function createPublisher(input: { walletAddress: string; platformName: string }) {
  const normalizedWallet = normalizeWallet(input.walletAddress)
  const supabase = createServerSupabaseClient()
  const payload: PublisherRecord = {
    id: crypto.randomUUID(),
    wallet_address: normalizedWallet,
    platform_name: input.platformName.trim(),
    api_key: buildVistaPublisherApiKey(),
    created_at: nowIso(),
  }

  if (!supabase) {
    const existingIndex = mockDb.publishers.findIndex((item) => item.wallet_address === normalizedWallet)

    if (existingIndex >= 0) {
      mockDb.publishers[existingIndex] = payload
    } else {
      mockDb.publishers.unshift(payload)
    }

    return clone(payload)
  }

  const { data, error } = await supabase.from("publishers").insert(payload).select("*").single()

  if (error) {
    throw new Error(error.message)
  }

  return data as PublisherRecord
}

export async function createAdvertiser(input: { walletAddress: string; companyName: string }) {
  const normalizedWallet = normalizeWallet(input.walletAddress)
  const supabase = createServerSupabaseClient()
  const payload: AdvertiserRecord = {
    id: crypto.randomUUID(),
    wallet_address: normalizedWallet,
    company_name: input.companyName.trim(),
    created_at: nowIso(),
  }

  if (!supabase) {
    const existingIndex = mockDb.advertisers.findIndex((item) => item.wallet_address === normalizedWallet)

    if (existingIndex >= 0) {
      mockDb.advertisers[existingIndex] = payload
    } else {
      mockDb.advertisers.unshift(payload)
    }

    return clone(payload)
  }

  const { data, error } = await supabase.from("advertisers").insert(payload).select("*").single()

  if (error) {
    throw new Error(error.message)
  }

  return data as AdvertiserRecord
}

export async function createCampaign(input: {
  campaignIdOnchain: string
  advertiserWallet: string
  title: string
  creativeUrl: string
  targetUrl: string
  totalBudget: number
  ratePerSecond: number
  targetPreferences: PreferenceOption[]
  targetMinAge: number | null
  targetMaxAge: number | null
  targetLocations: string[]
}) {
  const payload: CampaignRecord = {
    id: crypto.randomUUID(),
    campaign_id_onchain: input.campaignIdOnchain,
    advertiser_wallet: normalizeWallet(input.advertiserWallet),
    title: input.title.trim(),
    creative_url: input.creativeUrl.trim(),
    target_url: input.targetUrl.trim(),
    total_budget: input.totalBudget,
    remaining_budget: input.totalBudget,
    rate_per_second: input.ratePerSecond,
    target_preferences: input.targetPreferences.length ? input.targetPreferences : null,
    target_min_age: input.targetMinAge,
    target_max_age: input.targetMaxAge,
    target_locations: input.targetLocations.length ? input.targetLocations : null,
    active: true,
    created_at: nowIso(),
  }
  const supabase = createServerSupabaseClient()

  if (!supabase) {
    mockDb.campaigns.unshift(payload)
    return clone(payload)
  }

  const { data, error } = await supabase.from("campaigns").insert(payload).select("*").single()

  if (error) {
    throw new Error(error.message)
  }

  return normalizeCampaign(data as Record<string, unknown>)
}

export async function listCampaignsByAdvertiser(wallet: string) {
  const campaigns = await selectCampaignsByWallet(wallet)
  const sessions = await selectSessions({
    campaignIds: campaigns.map((campaign) => campaign.campaign_id_onchain),
  })

  return campaigns.map((campaign) => toCampaignListItem(campaign, sessions))
}

export async function updateCampaignById(
  id: string,
  updates: Partial<Pick<CampaignRecord, "active" | "remaining_budget">>
) {
  const supabase = createServerSupabaseClient()

  if (!supabase) {
    const campaign = mockDb.campaigns.find((item) => item.id === id || item.campaign_id_onchain === id)
    if (!campaign) {
      return null
    }

    Object.assign(campaign, updates)
    return clone(campaign)
  }

  const { data, error } = await supabase
    .from("campaigns")
    .update(updates)
    .eq("id", id)
    .select("*")
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ? normalizeCampaign(data as Record<string, unknown>) : null
}

export async function getAdvertiserDashboard(wallet: string): Promise<AdvertiserDashboardData> {
  const campaigns = await selectCampaignsByWallet(wallet)
  const sessions = await selectSessions({
    campaignIds: campaigns.map((campaign) => campaign.campaign_id_onchain),
  })

  const stats = {
    activeCampaigns: campaigns.filter((campaign) => campaign.active).length,
    totalUsdcSpent: sumNumbers(sessions.map((session) => session.total_paid_usdc)),
    totalVerifiedViewerSeconds: sumNumbers(sessions.map((session) => session.seconds_verified)),
    averageConversionRate: 23.4,
  }

  return {
    stats,
    campaigns: campaigns.map((campaign) => toCampaignListItem(campaign, sessions)),
    viewersPerDay: buildDaySeries(
      sessions.map((session) => ({
        date: session.started_at,
        value: 1,
        secondaryValue: session.total_paid_usdc,
      }))
    ),
  }
}

export async function getCampaignDetail(id: string): Promise<CampaignDetailData | null> {
  const campaign = await selectCampaignById(id)

  if (!campaign) {
    return null
  }

  const sessions = await selectSessions({ campaignIdOnchain: campaign.campaign_id_onchain })
  const ticks = await selectTicks({ sessionIds: sessions.map((session) => session.session_id_onchain) })

  return {
    campaign,
    stats: {
      totalViewers: sessions.length,
      totalSecondsVerified: sumNumbers(sessions.map((session) => session.seconds_verified)),
      totalUsdcSpent: sumNumbers(sessions.map((session) => session.total_paid_usdc)),
      remainingBudget: campaign.remaining_budget,
    },
    viewersPerDay: buildDaySeries(
      sessions.map((session) => ({
        date: session.started_at,
        value: 1,
        secondaryValue: session.total_paid_usdc,
      }))
    ),
    sessions: sessions.map((session) =>
      toSessionListItem(session, [campaign], ticks)
    ),
  }
}

export async function getPublisherDashboard(wallet: string): Promise<PublisherDashboardData> {
  const sessions = await selectSessions({ publisherWallet: wallet })
  const ticks = await selectTicks({ publisherWallet: wallet })
  const campaigns = await Promise.all(
    Array.from(new Set(sessions.map((session) => session.campaign_id_onchain))).map((id) =>
      selectCampaignById(id)
    )
  )

  return {
    stats: {
      totalUsdcEarned: sumNumbers(ticks.map((tick) => tick.publisher_amount)),
      totalAdImpressions: sessions.length,
      totalViewerSeconds: sumNumbers(sessions.map((session) => session.seconds_verified)),
      activeSessions: sessions.filter((session) => session.active).length,
    },
    revenuePerDay: buildDaySeries(
      ticks.map((tick) => ({
        date: tick.block_timestamp,
        value: tick.publisher_amount,
      }))
    ),
    recentSessions: sessions.slice(0, 6).map((session) =>
      toSessionListItem(
        session,
        campaigns.filter(Boolean) as CampaignRecord[],
        ticks
      )
    ),
  }
}

export async function getPublisherAnalytics(wallet: string): Promise<PublisherAnalyticsData> {
  const sessions = await selectSessions({ publisherWallet: wallet })
  const ticks = await selectTicks({ publisherWallet: wallet })
  const campaigns = await Promise.all(
    Array.from(new Set(sessions.map((session) => session.campaign_id_onchain))).map((id) =>
      selectCampaignById(id)
    )
  )
  const campaignLookup = new Map(
    (campaigns.filter(Boolean) as CampaignRecord[]).map((campaign) => [
      campaign.campaign_id_onchain,
      campaign,
    ])
  )
  const breakdownMap = new Map<
    string,
    { revenue: number; impressions: number; viewerSeconds: number }
  >()

  for (const session of sessions) {
    const current = breakdownMap.get(session.campaign_id_onchain) ?? {
      revenue: 0,
      impressions: 0,
      viewerSeconds: 0,
    }

    current.impressions += 1
    current.viewerSeconds += session.seconds_verified
    current.revenue += sumNumbers(
      ticks
        .filter((tick) => tick.session_id_onchain === session.session_id_onchain)
        .map((tick) => tick.publisher_amount)
    )

    breakdownMap.set(session.campaign_id_onchain, current)
  }

  const topTimeSlots = Array.from(
    ticks.reduce((accumulator, tick) => {
      const hour = new Date(tick.block_timestamp).getHours()
      accumulator.set(hour, (accumulator.get(hour) ?? 0) + tick.publisher_amount)
      return accumulator
    }, new Map<number, number>())
  )
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([hour, revenue]) => ({
      hour,
      label: formatHourLabel(hour),
      revenue,
    }))

  return {
    breakdownByCampaign: Array.from(breakdownMap.entries()).map(([campaignIdOnchain, summary]) => ({
      campaignIdOnchain,
      campaignTitle: campaignLookup.get(campaignIdOnchain)?.title ?? "Unknown campaign",
      revenue: summary.revenue,
      impressions: summary.impressions,
      viewerSeconds: summary.viewerSeconds,
    })),
    topTimeSlots,
    averageSessionDuration: average(sessions.map((session) => session.seconds_verified)),
  }
}

export async function createSession(input: {
  sessionIdOnchain: string
  campaignIdOnchain: string
  userWallet: string
  publisherWallet: string
}) {
  const payload: SessionRecord = {
    id: crypto.randomUUID(),
    session_id_onchain: input.sessionIdOnchain,
    campaign_id_onchain: input.campaignIdOnchain,
    user_wallet: normalizeWallet(input.userWallet),
    publisher_wallet: normalizeWallet(input.publisherWallet),
    seconds_verified: 0,
    total_paid_usdc: 0,
    active: true,
    started_at: nowIso(),
    ended_at: null,
  }
  const supabase = createServerSupabaseClient()

  if (!supabase) {
    mockDb.sessions.unshift(payload)
    return clone(payload)
  }

  const { data, error } = await supabase.from("sessions").insert(payload).select("*").single()

  if (error) {
    throw new Error(error.message)
  }

  return normalizeSession(data as Record<string, unknown>)
}

export async function recordTick(payload: OracleTickPayload) {
  const tickRecord: StreamTickRecord = {
    id: crypto.randomUUID(),
    session_id_onchain: payload.sessionIdOnchain,
    user_wallet: normalizeWallet(payload.userWallet),
    publisher_wallet: normalizeWallet(payload.publisherWallet),
    user_amount: payload.userAmount,
    publisher_amount: payload.publisherAmount,
    total_amount: payload.totalAmount,
    seconds_elapsed: payload.secondsElapsed,
    block_timestamp: payload.blockTimestamp,
    created_at: nowIso(),
  }
  const supabase = createServerSupabaseClient()

  if (!supabase) {
    mockDb.streamTicks.unshift(tickRecord)

    const session = mockDb.sessions.find(
      (item) => item.session_id_onchain === payload.sessionIdOnchain
    )
    const campaign = mockDb.campaigns.find(
      (item) => item.campaign_id_onchain === session?.campaign_id_onchain
    )

    if (session) {
      session.seconds_verified += payload.secondsElapsed
      session.total_paid_usdc += payload.totalAmount
    }

    if (campaign) {
      campaign.remaining_budget = Math.max(0, campaign.remaining_budget - payload.totalAmount)
      campaign.active = campaign.remaining_budget > 0
    }

    return clone(tickRecord)
  }

  const sessionQuery = await supabase
    .from("sessions")
    .select("*")
    .eq("session_id_onchain", payload.sessionIdOnchain)
    .maybeSingle()

  if (sessionQuery.error) {
    throw new Error(sessionQuery.error.message)
  }

  const session = sessionQuery.data ? normalizeSession(sessionQuery.data as Record<string, unknown>) : null

  const insertedTick = await supabase.from("stream_ticks").insert(tickRecord).select("*").single()
  if (insertedTick.error) {
    throw new Error(insertedTick.error.message)
  }

  if (session) {
    const updatedSession = await supabase
      .from("sessions")
      .update({
        seconds_verified: session.seconds_verified + payload.secondsElapsed,
        total_paid_usdc: session.total_paid_usdc + payload.totalAmount,
      })
      .eq("session_id_onchain", payload.sessionIdOnchain)

    if (updatedSession.error) {
      throw new Error(updatedSession.error.message)
    }

    const campaignQuery = await supabase
      .from("campaigns")
      .select("*")
      .eq("campaign_id_onchain", session.campaign_id_onchain)
      .maybeSingle()

    if (campaignQuery.error) {
      throw new Error(campaignQuery.error.message)
    }

    if (campaignQuery.data) {
      const campaign = normalizeCampaign(campaignQuery.data as Record<string, unknown>)
      const nextBudget = Math.max(0, campaign.remaining_budget - payload.totalAmount)

      const updatedCampaign = await supabase
        .from("campaigns")
        .update({
          remaining_budget: nextBudget,
          active: nextBudget > 0,
        })
        .eq("campaign_id_onchain", campaign.campaign_id_onchain)

      if (updatedCampaign.error) {
        throw new Error(updatedCampaign.error.message)
      }
    }
  }

  return normalizeTick(insertedTick.data as Record<string, unknown>)
}

export async function createReceipt(payload: OracleReceiptPayload) {
  const receipt: ReceiptRecord = {
    id: crypto.randomUUID(),
    token_id: payload.tokenId,
    session_id_onchain: payload.sessionIdOnchain,
    user_wallet: normalizeWallet(payload.userWallet),
    advertiser_wallet: normalizeWallet(payload.advertiserWallet),
    campaign_id_onchain: payload.campaignIdOnchain,
    seconds_verified: payload.secondsVerified,
    usdc_paid: payload.usdcPaid,
    minted_at: payload.mintedAt,
  }
  const supabase = createServerSupabaseClient()

  if (!supabase) {
    mockDb.receipts.unshift(receipt)
    const session = mockDb.sessions.find(
      (item) => item.session_id_onchain === payload.sessionIdOnchain
    )
    if (session) {
      session.active = false
      session.ended_at = payload.mintedAt
      session.seconds_verified = payload.secondsVerified
    }
    return clone(receipt)
  }

  const { data, error } = await supabase.from("receipts").insert(receipt).select("*").single()

  if (error) {
    throw new Error(error.message)
  }

  const sessionUpdate = await supabase
    .from("sessions")
    .update({
      active: false,
      ended_at: payload.mintedAt,
      seconds_verified: payload.secondsVerified,
    })
    .eq("session_id_onchain", payload.sessionIdOnchain)

  if (sessionUpdate.error) {
    throw new Error(sessionUpdate.error.message)
  }

  return normalizeReceipt(data as Record<string, unknown>)
}

export async function getActiveCampaignsForUser(userWallet: string): Promise<ActiveCampaignResult> {
  const user = await getUser(userWallet)
  const supabase = createServerSupabaseClient()

  if (!supabase) {
    return {
      user,
      campaigns: clone(
        mockDb.campaigns.filter(
          (campaign) =>
            campaign.active && campaign.remaining_budget > 0 && campaignMatchesUser(campaign, user)
        )
      ),
    }
  }

  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("active", true)
    .gt("remaining_budget", 0)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const campaigns = (data ?? [])
    .map((row) => normalizeCampaign(row as Record<string, unknown>))
    .filter((campaign) => campaignMatchesUser(campaign, user))

  return { user, campaigns }
}

export async function getUserDashboard(wallet: string): Promise<UserDashboardData> {
  const sessions = await selectSessions({ userWallet: wallet })
  const receipts = await selectReceipts(wallet)
  const ticks = await selectTicks({ userWallet: wallet })
  const campaigns = await Promise.all(
    Array.from(new Set(sessions.map((session) => session.campaign_id_onchain))).map((id) =>
      selectCampaignById(id)
    )
  )

  const categoryFrequency = new Map<string, number>()

  for (const session of sessions) {
    const campaign = campaigns.find((item) => item?.campaign_id_onchain === session.campaign_id_onchain)
    const topPreference = campaign?.target_preferences?.[0]

    if (topPreference) {
      categoryFrequency.set(topPreference, (categoryFrequency.get(topPreference) ?? 0) + 1)
    }
  }

  const favoriteAdCategory =
    Array.from(categoryFrequency.entries()).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "tech"
  const activeSession = sessions.find((session) => session.active) ?? null
  const activeTicks = activeSession
    ? ticks.filter((tick) => tick.session_id_onchain === activeSession.session_id_onchain)
    : []
  const currentAmount = sumNumbers(activeTicks.map((tick) => tick.user_amount))
  const currentSeconds = sumNumbers(activeTicks.map((tick) => tick.seconds_elapsed))
  const mostRecentTick = activeTicks[0]

  return {
    stats: {
      totalUsdcEarned: sumNumbers(receipts.map((receipt) => receipt.usdc_paid)),
      totalSessionsCompleted: sessions.filter((session) => !session.active).length,
      totalSecondsVerified: sumNumbers(sessions.map((session) => session.seconds_verified)),
      favoriteAdCategory,
    },
    liveSession: {
      sessionId: activeSession?.session_id_onchain ?? null,
      currentAmount,
      sessionSeconds: currentSeconds || activeSession?.seconds_verified || 0,
      ratePerSecond:
        mostRecentTick && mostRecentTick.seconds_elapsed > 0
          ? mostRecentTick.user_amount / mostRecentTick.seconds_elapsed
          : 0,
      verified: Boolean(activeSession),
    },
  }
}

export async function getUserHistory(wallet: string): Promise<UserHistoryData> {
  const sessions = await selectSessions({ userWallet: wallet })
  const receipts = await selectReceipts(wallet)
  const campaigns = await Promise.all(
    Array.from(new Set(sessions.map((session) => session.campaign_id_onchain))).map((id) =>
      selectCampaignById(id)
    )
  )

  return {
    sessions: sessions.map((session) => {
      const matchingReceipt = receipts.find(
        (receipt) => receipt.session_id_onchain === session.session_id_onchain
      )
      const matchingCampaign = campaigns.find(
        (campaign) => campaign?.campaign_id_onchain === session.campaign_id_onchain
      )

      return {
        date: session.started_at,
        duration: session.seconds_verified,
        earned: matchingReceipt?.usdc_paid ?? session.total_paid_usdc / 2,
        campaignTitle: matchingCampaign?.title ?? "Unknown campaign",
        receiptUrl: matchingReceipt
          ? buildMonadExplorerUrl("token", matchingReceipt.token_id)
          : null,
      }
    }),
    receipts: receipts.map((receipt) => ({
      tokenId: receipt.token_id,
      sessionIdOnchain: receipt.session_id_onchain,
      usdcEarned: receipt.usdc_paid,
      secondsVerified: receipt.seconds_verified,
      mintedAt: receipt.minted_at,
      explorerUrl: buildMonadExplorerUrl("token", receipt.token_id),
    })),
  }
}

export function getRoleDestination(role: RoleName) {
  return roleMeta[role]
}
