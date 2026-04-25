import { toBytes32 } from './contractCaller';
import type { TickResult, SessionState } from '../types';

const DASHBOARD_API_URL = process.env.DASHBOARD_API_URL ?? '';
const DASHBOARD_API_SECRET = process.env.DASHBOARD_API_SECRET ?? '';

export function syncSession(session: SessionState): void {
  if (!DASHBOARD_API_URL) return;
  fetch(`${DASHBOARD_API_URL}/api/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-oracle-secret': DASHBOARD_API_SECRET,
    },
    body: JSON.stringify({
      sessionIdOnchain: toBytes32(session.sessionId),
      campaignIdOnchain: session.campaignId,
      userWallet: session.userWallet,
      publisherWallet: session.publisherWallet,
    }),
  }).then(async res => {
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[syncSession] dashboard returned ${res.status}: ${body}`);
    }
  }).catch(err => console.error('[syncSession] dashboard sync failed', err));
}

export function syncTick(tick: TickResult, session: SessionState): void {
  if (!DASHBOARD_API_URL) return;
  fetch(`${DASHBOARD_API_URL}/api/ticks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-oracle-secret': DASHBOARD_API_SECRET,
    },
    body: JSON.stringify({
      sessionIdOnchain: toBytes32(session.sessionId),
      userWallet: session.userWallet,
      publisherWallet: session.publisherWallet,
      userAmount: Number(tick.userAmount),
      publisherAmount: Number(tick.publisherAmount),
      totalAmount: Number(tick.userAmount + tick.publisherAmount),
      secondsElapsed: tick.secondsElapsed,
      blockTimestamp: new Date().toISOString(),
    }),
  }).then(async res => {
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[syncTick] dashboard returned ${res.status}: ${body}`);
    }
  }).catch(err => console.error('[syncTick] dashboard sync failed', err));
}

export async function syncEnd(session: SessionState, txHash: string): Promise<void> {
  if (!DASHBOARD_API_URL) return;

  let advertiserWallet: string | undefined;
  try {
    const campaignRes = await fetch(`${DASHBOARD_API_URL}/api/campaigns/${encodeURIComponent(session.campaignId)}`);
    if (campaignRes.ok) {
      const campaign = await campaignRes.json();
      advertiserWallet = campaign.advertiserWallet;
    }
  } catch {}

  fetch(`${DASHBOARD_API_URL}/api/receipts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-oracle-secret': DASHBOARD_API_SECRET,
    },
    body: JSON.stringify({
      tokenId: txHash || crypto.randomUUID(),
      sessionIdOnchain: toBytes32(session.sessionId),
      userWallet: session.userWallet,
      publisherWallet: session.publisherWallet,
      advertiserWallet,
      campaignIdOnchain: session.campaignId,
      secondsVerified: session.validSeconds,
      usdcPaid: Number(session.totalPaid),
      mintedAt: new Date().toISOString(),
    }),
  }).then(async res => {
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[syncEnd] dashboard returned ${res.status}: ${body}`);
    }
  }).catch(err => console.error('[syncEnd] dashboard sync failed', err));
}
