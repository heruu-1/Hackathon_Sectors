# Handoff & Rencana Arsitektur: Evaluasi Sinyal, Risiko, dan Proyeksi Sesi RASI

## 1. Konteks dan Tujuan

Fitur ini merekonstruksi panel **“Evaluasi Hasil Sinyal”** pada tab riset saham RASI (`ResearchWorkspace.tsx`) menjadi sistem evaluasi sinyal dinamis untuk seluruh saham BEI/IHSG, yang mencakup:
1. Hasil aktual 1, 3, dan 5 sesi perdagangan BEI (Sesi I dan Sesi II).
2. Rencana risiko komprehensif setelah fee (SL, TP1, TP2, BEP, trailing stop, kalkulator alokasi lot modal).
3. Proyeksi stokastik Geometric Brownian Motion (GBM) murni TypeScript untuk horizon tersisa dengan kalkulasi probabilitas sentuhan level dan sensitivitas.
4. Penilaian kondisi teknis, kelengkapan data, dan panduan pemantauan sesi.

## 2. Temuan Audit & Resolusi

| Masalah Terverifikasi | Solusi Implementasi |
|---|---|
| `domain/signal-outcomes.ts` menghitung horizon pada data harian | Buat evaluator sesi kontinu intraday 5m; labeli hasil lama sebagai "berbasis hari bursa". |
| Parameter sinyal & tanggal dikirim dari state browser | Konteks sinyal (`SignalContext`) dibuat immutable dan diverifikasi penuh di server. |
| ID sementara `snap-...` menyebabkan foreign key failure di DB | Sinyal baru disimpan di tabel tersendiri (`signal_contexts` & `signal_analysis_runs`). |
| Kegagalan evaluasi tersamar oleh fallback memori | Pemisahan status: memuat, mengevaluasi, parsial, gagal, dan tersimpan. |
| Jam Sesi II pada skrip terdahulu mencapai 16.15 | Jam perdagangan kontinu Sesi II dibatasi ketat sampai 15.50 WIB (eksklusif). |
| Bar 15.45 dipakai sebelum selesai | Bar intraday memiliki `startAt` dan `endAt`; bar hanya valid jika `endAt <= asOf`. |

## 3. Komponen Utama & File Sasaran

1. **Kontrak Data**: `lib/contracts/signal-analysis.ts`, `lib/contracts/market.ts`
2. **Kalender Sesi BEI**: `domain/trading-sessions.ts`, `lib/data/idx-calendar-2026.json`
3. **Provider Intraday**: `lib/server/providers/intraday.ts`, `lib/server/env.ts`, `env.example`
4. **Outcome & Indikator**: `domain/signal-outcomes.ts`, `domain/signal-indicators.ts`
5. **Manajemen Risiko**: `domain/trade-risk.ts`
6. **Proyeksi Stokastik**: `domain/signal-projections.ts`
7. **Persistensi & Migrasi**: `db/schema.ts`, `drizzle/0004_signal_analysis.sql`, `scripts/migrate-signal-analysis.mjs`, `lib/server/repositories/signal-analysis.ts`
8. **Orkestrasi Backend**: `lib/server/services/signal-analysis.ts`, `app/actions.ts`, `lib/server/quota.ts`
9. **Antarmuka UI**: `components/SignalEvaluationPanel.tsx`, `components/signal-evaluation/*`, `components/ResearchWorkspace.tsx`
10. **Suite Pengujian**: `tests/trading-sessions.test.mjs`, `tests/trade-risk.test.mjs`, `tests/intraday-provider.test.mjs`, `tests/signal-projections.test.mjs`, `tests/signal-outcomes.test.mjs`
