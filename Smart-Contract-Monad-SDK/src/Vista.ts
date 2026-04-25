import { AttentionCollector } from './AttentionCollector';
import { HeartbeatSender } from './HeartbeatSender';
import { SessionManager } from './SessionManager';
import type {
  VistaConfig,
  HeartbeatPayload,
  HeartbeatResponse,
  EarnCallbackData,
  VistaStatus,
  OnboardingParams,
  EarningOverlayParams,
} from './types';

export class Vista {
  private config: VistaConfig | null = null;
  private collector: AttentionCollector | null = null;
  private sender: HeartbeatSender | null = null;
  private sessionManager: SessionManager | null = null;
  private earnCallback: ((data: EarnCallbackData) => void) | null = null;
  private sessionAmount: number = 0;
  private lastValidSeconds: number = 0;
  private lastScore: number = 0;
  private isActive: boolean = false;
  private beforeunloadHandler: (() => void) | null = null;
  private visibilitychangeHandler: (() => void) | null = null;
  private listenersSetup: boolean = false;
  private isFullscreenActive: boolean = false;
  private fullscreenchangeHandler: (() => void) | null = null;
  private trackedElementId: string | null = null;
  private overlayIntervalId: number | null = null;
  private overlayFullscreenHandler: (() => void) | null = null;
  private overlayScrollHandler: (() => void) | null = null;

  // ─── Public API ───────────────────────────────────────────

  init(config: VistaConfig): void {
    const required: (keyof VistaConfig)[] = [
      'apiKey',
      'userWallet',
      'oracleUrl',
      'campaignId',
      'publisherWallet',
    ];
    for (const field of required) {
      if (!config[field]) throw new Error(`VISTA: ${field} is required`);
    }
    this.removeSessionEndListeners();
    this.config = config;
    this.sender = new HeartbeatSender(config.oracleUrl);
    this.sessionManager = new SessionManager();
    this.setupSessionEndListeners();
  }

  attachZone(elementId: string): void {
    if (typeof window === 'undefined') {
      throw new Error('VISTA SDK requires browser environment');
    }
    if (!this.config || !this.sessionManager) {
      throw new Error('VISTA: call init() before attachZone()');
    }
    if (this.isActive) {
      throw new Error('VISTA: zone already attached, call detachZone() first');
    }
    this.collector = new AttentionCollector(elementId);
    this.trackedElementId = elementId;
    this.isActive = true;
    if (this.config!.requireFullscreen) {
      this.setupFullscreenListener();
    }
    this.sender!.start(
      () => this.buildPayload(),
      (res) => this.handleResponse(res),
      this.config!.requireFullscreen ? () => !this.isFullscreenActive : undefined
    );
    console.log('[VISTA] Zone attached:', elementId);
  }

  detachZone(): void {
    if (!this.isActive) return;
    this.isActive = false;
    this.sender?.stop();
    this.collector?.destroy();
    this.collector = null;
    this.removeFullscreenListener();
    this.removeEarningOverlay();
    this.isFullscreenActive = false;
    this.trackedElementId = null;
    this.postSessionEnd();
    this.sessionManager?.reset();
    console.log('[VISTA] Zone detached');
  }

  onEarn(callback: (data: EarnCallbackData) => void): void {
    this.earnCallback = callback;
  }

  getStatus(): VistaStatus {
    return {
      active: this.isActive,
      sessionId: this.sessionManager?.getSessionId() ?? null,
      validSeconds: this.lastValidSeconds,
      sessionAmount: this.sessionAmount,
      score: this.lastScore,
    };
  }

  showOnboardingModal(params: OnboardingParams): void {
    if (typeof window === 'undefined') return;
    if (document.getElementById('vista-onboarding-modal')) return;

    const colors = {
      background: 'oklch(0.2529 0.0415 279.0076)',
      foreground: 'oklch(0.9842 0.0034 247.8575)',
      card: 'oklch(0.3120 0.0503 278.3787)',
      primary: 'oklch(0.6255 0.1741 149.0136)',
      primaryForeground: 'oklch(1.0000 0 0)',
      mutedForeground: 'oklch(0.7322 0.0382 275.1551)',
      border: 'oklch(0.3548 0.0524 277.5527)',
      input: 'oklch(0.2087 0.0377 278.0260)',
    };

    const modal = document.createElement('div');
    modal.id = 'vista-onboarding-modal';
    Object.assign(modal.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '999999',
      backdropFilter: 'blur(4px)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    });

    const container = document.createElement('div');
    Object.assign(container.style, {
      position: 'relative',
      width: '90%',
      maxWidth: '600px',
      maxHeight: '90vh',
      backgroundColor: colors.card,
      borderRadius: '28px',
      overflowY: 'auto',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      border: `1px solid ${colors.border}`,
      padding: '32px',
      color: colors.foreground,
    });

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    Object.assign(closeBtn.style, {
      position: 'absolute',
      top: '20px',
      right: '20px',
      background: 'transparent',
      border: 'none',
      color: colors.mutedForeground,
      fontSize: '24px',
      cursor: 'pointer',
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'color 0.2s',
    });
    closeBtn.onmouseover = () => (closeBtn.style.color = colors.foreground);
    closeBtn.onmouseout = () => (closeBtn.style.color = colors.mutedForeground);
    closeBtn.onclick = () => {
      if (document.body.contains(modal)) document.body.removeChild(modal);
    };

    const header = document.createElement('div');
    header.innerHTML = `
      <h2 style="margin:0 0 6px 0;font-size:24px;font-weight:600;letter-spacing:-0.02em;">Tell VISTA what to show you</h2>
      <p style="margin:0 0 24px 0;color:${colors.mutedForeground};font-size:14px;">Add your age, location, and preference profile so the Oracle can route relevant campaigns.</p>
    `;

    const form = document.createElement('form');

    const inputStyle = `width:100%;background:transparent;border:1px solid ${colors.input};border-radius:6px;padding:9px 12px;color:${colors.foreground};margin-bottom:20px;box-sizing:border-box;font-size:14px;outline:none;transition:border 0.2s;`;
    const labelStyle = `display:block;margin-bottom:8px;font-size:14px;font-weight:500;color:${colors.foreground};`;

    const flexContainer = document.createElement('div');
    flexContainer.style.cssText = 'display:flex;gap:16px;width:100%;';

    const ageContainer = document.createElement('div');
    ageContainer.style.flex = '1';
    ageContainer.innerHTML = `<label style="${labelStyle}">Age</label>`;
    const ageInput = document.createElement('input');
    ageInput.type = 'number';
    ageInput.min = '13';
    ageInput.value = '27';
    ageInput.style.cssText = inputStyle;
    ageInput.onfocus = () => (ageInput.style.border = `1px solid ${colors.primary}`);
    ageInput.onblur = () => (ageInput.style.border = `1px solid ${colors.input}`);
    ageContainer.appendChild(ageInput);

    const locContainer = document.createElement('div');
    locContainer.style.flex = '1';
    locContainer.innerHTML = `<label style="${labelStyle}">Location</label>`;
    const locationInput = document.createElement('input');
    locationInput.type = 'text';
    locationInput.value = 'Jakarta';
    locationInput.style.cssText = inputStyle;
    locationInput.onfocus = () => (locationInput.style.border = `1px solid ${colors.primary}`);
    locationInput.onblur = () => (locationInput.style.border = `1px solid ${colors.input}`);
    locContainer.appendChild(locationInput);

    flexContainer.appendChild(ageContainer);
    flexContainer.appendChild(locContainer);

    const prefsContainer = document.createElement('div');
    prefsContainer.innerHTML = `<label style="${labelStyle}">Preferences</label>
      <p style="margin:0 0 16px 0;font-size:13px;color:${colors.mutedForeground};">Pick all categories you want VISTA to target.</p>`;

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:32px;';

    const ALL_PREFS = [
      'tech',
      'gaming',
      'fashion',
      'sport',
      'food',
      'healthy',
      'finance',
      'crypto',
      'travel',
      'music',
      'automotive',
      'beauty',
    ];
    ALL_PREFS.forEach((p) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'vista-pref-btn';
      btn.dataset.val = p;
      btn.dataset.selected = p === 'tech' || p === 'gaming' ? 'true' : 'false';
      btn.innerHTML = `<div style="font-weight:500;margin-bottom:4px;">${
        p.charAt(0).toUpperCase() + p.slice(1)
      }</div>`;

      const updateBtnStyle = () => {
        if (btn.dataset.selected === 'true') {
          btn.style.cssText = `padding:16px;border-radius:24px;font-size:14px;cursor:pointer;background:color-mix(in oklch, ${colors.primary} 10%, transparent);border:1px solid ${colors.primary};color:${colors.primary};text-align:left;transition:all 0.2s;`;
        } else {
          btn.style.cssText = `padding:16px;border-radius:24px;font-size:14px;cursor:pointer;background:color-mix(in oklch, ${colors.background} 70%, transparent);border:1px solid color-mix(in oklch, ${colors.border} 70%, transparent);color:${colors.foreground};text-align:left;transition:all 0.2s;`;
        }
      };
      updateBtnStyle();

      btn.onclick = (ev) => {
        ev.preventDefault();
        btn.dataset.selected = btn.dataset.selected === 'true' ? 'false' : 'true';
        updateBtnStyle();
      };
      grid.appendChild(btn);
    });
    prefsContainer.appendChild(grid);

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.innerText = 'Create user profile';
    submitBtn.style.cssText = `width:100%;padding:10px 16px;background:${colors.primary};color:${colors.primaryForeground};border:none;border-radius:6px;font-weight:500;font-size:14px;cursor:pointer;transition:opacity 0.2s;height:40px;`;
    submitBtn.onmouseover = () => (submitBtn.style.opacity = '0.9');
    submitBtn.onmouseout = () => (submitBtn.style.opacity = '1');

    form.onsubmit = async (evt) => {
      evt.preventDefault();
      submitBtn.disabled = true;
      submitBtn.innerText = 'Saving profile...';

      const prefs = Array.from(
        document.querySelectorAll('.vista-pref-btn[data-selected="true"]')
      ).map((el) => (el as HTMLElement).dataset.val);

      try {
        const targetUrl = (params.dashboardUrl || 'http://localhost:3031') + '/api/users';
        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: params.wallet,
            age: parseInt(ageInput.value) || 27,
            location: locationInput.value || 'Jakarta',
            preferences: prefs,
          }),
        });

        if (!res.ok) throw new Error('Failed to save profile');

        if (document.body.contains(modal)) {
          document.body.removeChild(modal);
        }
        window.postMessage('VISTA_ONBOARDING_COMPLETE', '*');
      } catch (err) {
        console.error('[VISTA] Onboarding error:', err);
        submitBtn.innerText = 'Error - Try Again';
        submitBtn.disabled = false;
      }
    };

    form.appendChild(flexContainer);
    form.appendChild(prefsContainer);
    form.appendChild(submitBtn);

    container.appendChild(closeBtn);
    container.appendChild(header);
    container.appendChild(form);
    modal.appendChild(container);
    document.body.appendChild(modal);
  }

  showEarningOverlay(params?: EarningOverlayParams): void {
    if (typeof window === 'undefined') return;
    if (document.getElementById('vista-earning-overlay')) return;

    const fsEl    = document.fullscreenElement as HTMLElement | null;
    const anchor  = params?.targetElement ?? null;

    if (!document.getElementById('vista-overlay-styles')) {
      const style = document.createElement('style');
      style.id = 'vista-overlay-styles';
      style.textContent = `
        @keyframes vista-slide-in {
          from { transform: translateX(12px) scale(0.96); opacity: 0; }
          to   { transform: translateX(0)    scale(1);    opacity: 1; }
        }
        @keyframes vista-pulse-dot {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
          50%       { opacity: 0.7; box-shadow: 0 0 0 5px rgba(34,197,94,0); }
        }
        #vista-earning-overlay { animation: vista-slide-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }
        #vista-overlay-close:hover { background: rgba(255,255,255,0.08) !important; color: #f0fdf4 !important; }
      `;
      document.head.appendChild(style);
    }

    const c = {
      bg:         'rgba(10, 18, 30, 0.92)',
      border:     'rgba(34, 197, 94, 0.22)',
      primary:    '#22c55e',
      primaryDim: 'rgba(34, 197, 94, 0.12)',
      text:       '#f0fdf4',
      muted:      '#94a3b8',
      accent:     '#4ade80',
      surface:    'rgba(255, 255, 255, 0.05)',
    };

    const OVERLAY_W = 272;
    const OVERLAY_GAP = 14;

    const status = this.getStatus();
    const safeAmount  = isNaN(status.sessionAmount) ? 0 : status.sessionAmount;
    const safeScore   = isNaN(status.score)         ? 0 : status.score;
    const safeSecs    = isNaN(status.validSeconds)   ? 0 : status.validSeconds;

    const overlay = document.createElement('div');
    overlay.id = 'vista-earning-overlay';
    Object.assign(overlay.style, {
      position:             'fixed',
      width:                `${OVERLAY_W}px`,
      top:                  '-9999px',
      left:                 '-9999px',
      backgroundColor:      c.bg,
      border:               `1px solid ${c.border}`,
      borderRadius:         '18px',
      padding:              '16px',
      zIndex:               '2147483647',
      fontFamily:           'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      color:                c.text,
      backdropFilter:       'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      boxShadow:            '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(34,197,94,0.08)',
      userSelect:           'none',
    });

    const titleHtml = params?.campaignTitle
      ? `<span style="font-size:11px;color:${c.muted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:110px;">${params.campaignTitle}</span>`
      : '';

    const amountHtml = (v: number) =>
      `$${v.toFixed(6)}&thinsp;<span style="font-size:13px;color:${c.accent};font-weight:600;">USDC</span>`;

    overlay.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:7px;">
          <span style="font-size:15px;color:${c.accent};">✦</span>
          <span style="font-size:12px;font-weight:700;letter-spacing:0.06em;color:${c.accent};">VISTA</span>
          ${titleHtml}
        </div>
        <button id="vista-overlay-close" style="background:transparent;border:none;color:${c.muted};font-size:15px;cursor:pointer;padding:3px 7px;border-radius:8px;line-height:1;transition:background 0.15s,color 0.15s;">✕</button>
      </div>

      <div style="display:flex;align-items:center;gap:7px;padding:8px 11px;background:${c.primaryDim};border-radius:9px;border:1px solid rgba(34,197,94,0.18);margin-bottom:14px;">
        <span id="vista-status-dot" style="width:8px;height:8px;border-radius:50%;background:${c.primary};flex-shrink:0;display:inline-block;animation:vista-pulse-dot 1.8s ease-in-out infinite;"></span>
        <span id="vista-status-text" style="font-size:11px;font-weight:700;letter-spacing:0.07em;color:${c.primary};">MONETIZING ACTIVE</span>
      </div>

      <div style="margin-bottom:13px;">
        <div style="font-size:10px;color:${c.muted};letter-spacing:0.09em;font-weight:600;text-transform:uppercase;margin-bottom:5px;">Session → Escrow</div>
        <div id="vista-overlay-amount" style="font-size:24px;font-weight:700;color:${c.text};letter-spacing:-0.02em;line-height:1.1;">
          ${amountHtml(safeAmount)}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:13px;">
        <div style="background:${c.surface};border-radius:10px;padding:9px 11px;">
          <div style="font-size:10px;color:${c.muted};text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px;">Attention</div>
          <div id="vista-overlay-score" style="font-size:16px;font-weight:700;">${Math.round(safeScore * 100)}%</div>
        </div>
        <div style="background:${c.surface};border-radius:10px;padding:9px 11px;">
          <div style="font-size:10px;color:${c.muted};text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px;">Verified</div>
          <div id="vista-overlay-seconds" style="font-size:16px;font-weight:700;">${safeSecs}s</div>
        </div>
      </div>

      <div style="font-size:10px;color:${c.muted};padding-top:10px;border-top:1px solid rgba(255,255,255,0.07);display:flex;align-items:center;gap:5px;">
        <span style="font-size:12px;">⛓</span>
        <span>Earnings settle to on-chain escrow every 10 seconds</span>
      </div>
    `;

    document.body.appendChild(overlay);

    // Position the overlay to the right of the anchor element (or inside fullscreen)
    const positionOverlay = () => {
      const el = document.getElementById('vista-earning-overlay');
      if (!el) return;
      if (fsEl && !anchor) {
        // Inside fullscreen: absolute bottom-right
        el.style.position = 'absolute';
        el.style.bottom   = '12px';
        el.style.right    = '12px';
        el.style.top      = 'auto';
        el.style.left     = 'auto';
        return;
      }
      const ref = anchor ?? (fsEl as HTMLElement | null);
      if (!ref) {
        // Fallback: fixed bottom-right
        el.style.bottom = '20px';
        el.style.right  = '20px';
        el.style.top    = 'auto';
        el.style.left   = 'auto';
        return;
      }
      const rect   = ref.getBoundingClientRect();
      const gap    = OVERLAY_GAP;
      const spaceR = window.innerWidth - rect.right - gap;
      let left: number;
      if (spaceR >= OVERLAY_W) {
        left = rect.right + gap;
      } else {
        // Not enough room to the right — try left side
        left = Math.max(4, rect.left - OVERLAY_W - gap);
      }
      const top = Math.max(4, rect.top + 4);
      el.style.top  = `${top}px`;
      el.style.left = `${left}px`;
      el.style.bottom = 'auto';
      el.style.right  = 'auto';
    };

    // Attach inside fullscreen element so it renders on top
    if (fsEl && !anchor) {
      fsEl.style.position = fsEl.style.position || 'relative';
      fsEl.appendChild(overlay);
      overlay.style.position = 'absolute';
    }

    positionOverlay();

    document.getElementById('vista-overlay-close')?.addEventListener('click', () => {
      this.removeEarningOverlay();
    });

    this.overlayScrollHandler = positionOverlay;
    window.addEventListener('scroll', positionOverlay, { passive: true });
    window.addEventListener('resize', positionOverlay, { passive: true });

    let prevAmount = safeAmount;

    this.overlayIntervalId = window.setInterval(() => {
      const s       = this.getStatus();
      const amount  = isNaN(s.sessionAmount) ? 0 : s.sessionAmount;
      const score   = isNaN(s.score)         ? 0 : s.score;
      const secs    = isNaN(s.validSeconds)   ? 0 : s.validSeconds;

      const amountEl  = document.getElementById('vista-overlay-amount');
      const scoreEl   = document.getElementById('vista-overlay-score');
      const secondsEl = document.getElementById('vista-overlay-seconds');
      const dotEl     = document.getElementById('vista-status-dot');
      const textEl    = document.getElementById('vista-status-text');

      if (amountEl && amount !== prevAmount) {
        const from = prevAmount;
        prevAmount = amount;
        this.animateValue(amountEl, from, amount, 700, amountHtml);
      }
      if (scoreEl)   scoreEl.textContent   = `${Math.round(score * 100)}%`;
      if (secondsEl) secondsEl.textContent = `${secs}s`;
      if (dotEl)     dotEl.style.background = s.active ? c.primary : c.muted;
      if (textEl) {
        textEl.textContent = s.active ? 'MONETIZING ACTIVE' : 'TRACKING PAUSED';
        textEl.style.color = s.active ? c.primary : c.muted;
      }
    }, 1000);

    if (fsEl && !anchor) {
      this.overlayFullscreenHandler = () => {
        if (!document.fullscreenElement) this.removeEarningOverlay();
      };
      document.addEventListener('fullscreenchange', this.overlayFullscreenHandler);
    }
  }

  // ─── Private Methods ──────────────────────────────────────

  private removeEarningOverlay(): void {
    const el = document.getElementById('vista-earning-overlay');
    if (el?.parentElement) el.parentElement.removeChild(el);
    if (this.overlayIntervalId !== null) {
      clearInterval(this.overlayIntervalId);
      this.overlayIntervalId = null;
    }
    if (this.overlayFullscreenHandler) {
      document.removeEventListener('fullscreenchange', this.overlayFullscreenHandler);
      this.overlayFullscreenHandler = null;
    }
    if (this.overlayScrollHandler) {
      window.removeEventListener('scroll', this.overlayScrollHandler);
      window.removeEventListener('resize', this.overlayScrollHandler);
      this.overlayScrollHandler = null;
    }
  }

  private animateValue(
    el: HTMLElement,
    from: number,
    to: number,
    duration: number,
    format: (v: number) => string,
  ): void {
    const startTime = performance.now();
    const tick = (now: number) => {
      const t      = Math.min((now - startTime) / duration, 1);
      const eased  = 1 - Math.pow(1 - t, 3); // ease-out cubic
      el.innerHTML = format(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private buildPayload(): HeartbeatPayload {
    const signals = this.collector!.collect();
    const score = this.collector!.calculateScore(signals);
    return {
      sessionId: this.sessionManager!.getSessionId(),
      apiKey: this.config!.apiKey,
      userWallet: this.config!.userWallet,
      campaignId: this.config!.campaignId,
      publisherWallet: this.config!.publisherWallet,
      timestamp: Date.now(),
      nonce: this.sessionManager!.generateNonce(),
      score,
      signals,
    };
  }

  private handleResponse(res: HeartbeatResponse): void {
    this.lastScore = res.score;
    if (!res.valid) return;

    const secondsDiff = res.validSeconds - this.lastValidSeconds;
    this.lastValidSeconds = res.validSeconds;

    if (secondsDiff > 0 && this.earnCallback) {
      const estimatedTickAmount = secondsDiff * 0.000333;
      this.sessionAmount += estimatedTickAmount;

      this.earnCallback({
        sessionAmount: this.sessionAmount,
        tickAmount: estimatedTickAmount,
        validSeconds: res.validSeconds,
        score: res.score,
        flagged: res.flagged,
      });
    }
  }

  private async postSessionEnd(): Promise<void> {
    if (!this.config || !this.sessionManager) return;
    try {
      await fetch(`${this.config.oracleUrl}/session/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionManager.getSessionId(),
          apiKey: this.config.apiKey,
        }),
      });
    } catch (err) {
      console.warn('[VISTA] Session end failed:', err);
    }
  }

  private setupFullscreenListener(): void {
    this.isFullscreenActive = this.checkIsFullscreen();
    this.fullscreenchangeHandler = () => {
      this.isFullscreenActive = this.checkIsFullscreen();
      console.log('[VISTA] Fullscreen:', this.isFullscreenActive);
    };
    document.addEventListener('fullscreenchange', this.fullscreenchangeHandler);
  }

  private removeFullscreenListener(): void {
    if (this.fullscreenchangeHandler) {
      document.removeEventListener('fullscreenchange', this.fullscreenchangeHandler);
      this.fullscreenchangeHandler = null;
    }
  }

  private checkIsFullscreen(): boolean {
    if (!this.trackedElementId) return false;
    const fsEl = document.fullscreenElement;
    if (!fsEl) return false;
    const tracked = document.getElementById(this.trackedElementId);
    if (!tracked) return false;
    return fsEl === tracked || fsEl.contains(tracked) || tracked.contains(fsEl);
  }

  private setupSessionEndListeners(): void {
    if (typeof window === 'undefined') return;
    if (this.listenersSetup) return;

    this.beforeunloadHandler = () => {
      this.detachZone();
    };

    this.visibilitychangeHandler = () => {
      if (document.visibilityState !== 'hidden') return;
      // Some browsers briefly fire visibilitychange('hidden') when entering
      // fullscreen before fullscreenchange fires. Debounce so fullscreenchange
      // has time to set document.fullscreenElement first.
      setTimeout(() => {
        if (document.visibilityState === 'hidden' && !document.fullscreenElement) {
          this.detachZone();
        }
      }, 200);
    };

    window.addEventListener('beforeunload', this.beforeunloadHandler);
    document.addEventListener('visibilitychange', this.visibilitychangeHandler);
    this.listenersSetup = true;
  }

  private removeSessionEndListeners(): void {
    if (typeof window === 'undefined') return;
    if (!this.listenersSetup) return;

    if (this.beforeunloadHandler) {
      window.removeEventListener('beforeunload', this.beforeunloadHandler);
      this.beforeunloadHandler = null;
    }

    if (this.visibilitychangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilitychangeHandler);
      this.visibilitychangeHandler = null;
    }

    this.listenersSetup = false;
  }
}

export const vista = new Vista();
