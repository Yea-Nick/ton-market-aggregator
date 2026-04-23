# TON Price Aggregator

Real-time backend service for aggregating **TON (The Open Network)** prices across multiple exchanges.

This project focuses on building a **reliable event-driven pipeline** with strong guarantees around **data consistency**, **idempotency**, and **real-time delivery**.

---

## 🌐 Live Demo

https://tonspread.tech

> Real-time TON price aggregation with WebSocket streaming

---

## 🚀 Overview

The system aggregates price data from:

- **CEX**: Bybit, Bitget  
- **DEX**: STON.fi, DeDust  

Data is processed through a Kafka-based pipeline and exposed via **REST API** and **WebSocket** for real-time updates.

---

## 🏗 Architecture

```text
Exchange APIs
     ↓
exchange-poller
     ↓
Kafka (ton.prices.raw)
     ↓
prices-service
     ↓
PostgreSQL
     ↓
WebSocket / REST API
```

## ⚙️ Tech Stack

- **Node.js / NestJS** — service layer  
- **Kafka** — event streaming backbone  
- **PostgreSQL** — storage  
- **Docker** — local orchestration  
- **Nginx** — reverse proxy

---

## 🔁 Data Flow

1. Poller services fetch data from exchanges  
2. Events are published to Kafka  
3. Consumer processes events and persists them  
4. Updates are pushed to clients via WebSocket  

---

## 🧠 Key Design Decisions

### 1. Handling duplicates

Kafka provides **at-least-once delivery**, so duplicate events are expected.

The system uses:

- transactional inbox pattern  
- unique `event_id` per message  
- atomic database transactions  

This ensures **effectively-once processing** without relying on Kafka transactions.

---

### 2. Why Kafka

Kafka acts as a decoupling layer between ingestion and processing:

- absorbs spikes from external APIs  
- enables independent scaling  
- allows event replay  

---

### 3. Real-time delivery

WebSocket is used to push updates to clients:

- low latency  
- efficient fan-out  
- no polling overhead  

---

### 4. Database approach

PostgreSQL is used as the source of truth:

- append-only storage for price ticks  
- indexed queries for time-series access  
- efficient retrieval of latest prices  

---

## 🐳 Running Locally

```bash
make dev
```
Production mode:
```bash
make prod
```

---

## 📈 Possible Improvements
- Observability (metrics, tracing)
- Horizontal scaling for consumers