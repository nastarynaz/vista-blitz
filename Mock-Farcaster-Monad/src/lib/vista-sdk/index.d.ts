interface VistaConfig {
    apiKey: string;
    userWallet: string;
    oracleUrl: string;
    campaignId: string;
    publisherWallet: string;
}
interface AttentionSignals {
    visibility: number;
    tabFocused: boolean;
    mouseActive: boolean;
    scrolled: boolean;
}
interface HeartbeatPayload {
    sessionId: string;
    apiKey: string;
    userWallet: string;
    campaignId: string;
    publisherWallet: string;
    timestamp: number;
    nonce: string;
    score: number;
    signals: AttentionSignals;
}
interface HeartbeatResponse {
    valid: boolean;
    score: number;
    validSeconds: number;
    pendingSeconds: number;
    flagged: boolean;
    error?: string;
}
interface EarnCallbackData {
    sessionAmount: number;
    tickAmount: number;
    validSeconds: number;
    score: number;
    flagged: boolean;
}
interface VistaStatus {
    active: boolean;
    sessionId: string | null;
    validSeconds: number;
    sessionAmount: number;
    score: number;
}

declare class Vista {
    private config;
    private collector;
    private sender;
    private sessionManager;
    private earnCallback;
    private sessionAmount;
    private lastValidSeconds;
    private lastScore;
    private isActive;
    init(config: VistaConfig): void;
    attachZone(elementId: string): void;
    detachZone(): void;
    onEarn(callback: (data: EarnCallbackData) => void): void;
    getStatus(): VistaStatus;
    private buildPayload;
    private handleResponse;
    private postSessionEnd;
    private setupSessionEndListeners;
}
declare const vista: Vista;

export { type AttentionSignals, type EarnCallbackData, type HeartbeatPayload, type HeartbeatResponse, vista as Vista, type VistaConfig, type VistaStatus };
