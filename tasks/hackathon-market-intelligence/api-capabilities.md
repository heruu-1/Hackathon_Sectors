# Registry Kemampuan Sectors API v2

| Capability ID              | Endpoint / Pola URL                                  | Biaya (Kredit)                   | Status Akses | Strategi Fallback                                                   |
| -------------------------- | ---------------------------------------------------- | -------------------------------- | ------------ | ------------------------------------------------------------------- |
| `companies_screener`       | `/v2/companies/`                                     | 1 per call                       | `AVAILABLE`  | Gunakan data cache atau filter lokal                                |
| `daily_price`              | `/v2/daily/{symbol}/`                                | 1 per call (rentang s/d 90 hari) | `AVAILABLE`  | Gunakan data sesi terakhir yang tersimpan                           |
| `daily_full_universe`      | `/v2/daily/`                                         | 1 per call (jika didukung)       | `UNVERIFIED` | Screener companies + detail per kandidat                            |
| `broker_summary`           | `/v2/broker-summary/{symbol}/`                       | 1 per call (maks 14 hari)        | `AVAILABLE`  | Agregasi dari broker activity atau tandai kosong                    |
| `broker_activity`          | `/v2/broker-activity/{code}/`                        | 1 per call (maks 14 hari)        | `AVAILABLE`  | Batasi ke 1-5 sesi per request                                      |
| `brokers_registry`         | `/v2/brokers/`                                       | 1 per call                       | `AVAILABLE`  | Cache 7 hari                                                        |
| `foreign_flow`             | `/v2/foreign-flow/{symbol}/`                         | 1 per call                       | `AVAILABLE`  | Hitung dari broker summary bila ada f_bval                          |
| `market_news`              | `/v2/news/`                                          | 1 per call                       | `AVAILABLE`  | Cache 60 menit                                                      |
| `filings`                  | `/v2/filings/`                                       | 1 per call                       | `AVAILABLE`  | Cache 60 menit                                                      |
| `corporate_actions`        | `/v2/company/{symbol}/corporate-actions/`            | 1 per call                       | `AVAILABLE`  | Tampilkan catatan tanpa penyesuaian                                 |
| `financials_quarterly`     | `/v2/financials/quarterly/{symbol}/`                 | 1 per kuartal dikembalikan       | `AVAILABLE`  | Batasi maks 5 kuartal per request                                   |
| `company_report`           | `/v2/company/report/{symbol}/`                       | 1 per section diminta            | `AVAILABLE`  | Hanya minta sections yang dibutuhkan (e.g. `valuation`, `segments`) |
| `shareholders_composition` | `/v2/company/report/{symbol}/?sections=shareholders` | 1 per call                       | `AVAILABLE`  | Cache 24 jam                                                        |
| `free_float`               | `/v2/screener/free-float/`                           | Bervariasi                       | `UNVERIFIED` | Ambil dari company report atau tandai missing                       |
| `index_daily`              | `/v2/index-daily/{index_code}/`                      | 1 per call                       | `AVAILABLE`  | Perbandingan dengan IHSG (COMPOSITE)                                |
| `mining_data`              | `/v2/mining/...`                                     | Bervariasi                       | `UNVERIFIED` | Batasi ke segmen bisnis, jangan tebak data tambang                  |
| `suspension_history`       | `/v2/suspensions/...`                                | Bervariasi                       | `UNVERIFIED` | Tampilkan "riwayat belum dapat diperiksa"                           |

## Status Akses:

- `UNVERIFIED`: Belum diverifikasi akses aktualnya pada runtime.
- `AVAILABLE`: Terbukti mengembalikan data 200 OK dengan format terstandar.
- `FORBIDDEN`: Mengembalikan 403 (tidak termasuk dalam paket API).
- `UNAVAILABLE`: Mengembalikan 404/500/timeout atau tidak tersedia.
