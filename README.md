# 🌌 Vista Blitz

**Real-time Attention Monetization Protocol on Monad**

Vista Blitz is a decentralized advertising infrastructure that enables users to earn USDC in real-time simply by viewing content. By leveraging high-throughput blockchain (Monad) and advanced attention-tracking technology, we create a fair and transparent ecosystem for Advertisers, Publishers, and Users.

## 🚀 Live Demos

- **Mock Farcaster Client:** [https://vista-blitz.vercel.app/](https://vista-blitz.vercel.app/)
- **Protocol Dashboard:** [https://vista-superdash.vercel.app/](https://vista-superdash.vercel.app/)

---

## 🏗️ Architecture: How It Works

The Vista ecosystem consists of three primary components working in sync:

### 1. 🛠️ The Vista SDK
The core engine of the protocol. It is a lightweight JavaScript library that publishers (like social media apps or news sites) integrate into their platforms.
- **Attention Tracking:** Uses sophisticated browser signals (visibility, mouse movement, scroll depth) to verify real-time attention.
- **Heartbeat System:** Sends periodic "proof-of-attention" heartbeats to the Vista Oracle.
- **Real-time Rewards:** Triggers per-second earnings for users based on their engagement score.

### 2. 📊 Super Dashboard
A unified interface for all protocol participants to manage their activity and view analytics.

#### **For Advertisers**
Create and fund campaigns, set target metrics, and track ROI with precision.
![Advertiser Dashboard](screenshots/advertiser.png)

#### **For Publishers**
Manage ad zones, monitor site performance, and track revenue generated from hosted ads.
![Publisher Dashboard](screenshots/publisher.png)

#### **For Users**
Track lifetime earnings, view detailed session history, and manage profile preferences to receive more relevant ads.
![User Dashboard](screenshots/user.png)

### 3. 📱 Mock Farcaster (Client Simulation)
A functional demonstration of how the Vista SDK transforms a standard social media experience. 
- In this mock client, users browse a Farcaster-like feed.
- When an ad enters the viewport, the SDK activates.
- A real-time USDC ticker shows earnings accumulating second-by-second.
![Mock Client Earnings](screenshots/mock-getmoney.png)

---

## ⚙️ Core Components

- **Smart Contracts:** Deployed on Monad, handling secure settlement and session-based NFT receipt minting.
- **Oracle Server:** Verifies attention signals and signs reward claims to prevent bot activity.
- **Ponder Indexer:** Provides lightning-fast data for the dashboard analytics.

## 🛠️ Repository Structure

- `/Smart-Contract-Monad-SDK`: Core Solidity contracts and the `@vista-protocol/sdk` source.
- `/Super-Dashboard`: Next.js application for the protocol management UI.
- `/Mock-Farcaster-Monad`: Example integration showing the SDK in a social media context.
- `/Oracle-Server-Production`: Backend verification engine.
- `/Ponder-Production`: Real-time indexing service.

---

Built for **Monad Blitz Jogja**.