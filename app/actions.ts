'use server'

import * as assistant from './actions/assistant'
import * as history from './actions/history'
import * as market from './actions/market'
import * as radar from './actions/radar'
import * as signal from './actions/signal'
import * as watchlist from './actions/watchlist'

export type { MarketRadarData, RadarHistorySnapshot } from './actions/radar'
export type { ScreenerResult } from './actions/market'

// Watchlist
export async function getWatchlist() {
  return watchlist.getWatchlist()
}

export async function addToWatchlist(item: Parameters<typeof watchlist.addToWatchlist>[0]) {
  return watchlist.addToWatchlist(item)
}

export async function updateWatchlistItem(
  id: Parameters<typeof watchlist.updateWatchlistItem>[0],
  patch: Parameters<typeof watchlist.updateWatchlistItem>[1],
) {
  return watchlist.updateWatchlistItem(id, patch)
}

export async function deleteWatchlistItem(
  idOrTicker: Parameters<typeof watchlist.deleteWatchlistItem>[0],
) {
  return watchlist.deleteWatchlistItem(idOrTicker)
}

// Assistant
export async function listConversationsAction() {
  return assistant.listConversationsAction()
}

export async function getConversationAction(conversationId: string) {
  return assistant.getConversationAction(conversationId)
}

export async function deleteConversationAction(conversationId: string) {
  return assistant.deleteConversationAction(conversationId)
}

// Radar
export async function getMarketRadarFeed(options?: Parameters<typeof radar.getMarketRadarFeed>[0]) {
  return radar.getMarketRadarFeed(options)
}

export async function getRadarHistory() {
  return radar.getRadarHistory()
}

export async function clearRadarHistory() {
  return radar.clearRadarHistory()
}

// Signal
export async function getSignalOutcomesAction(ticker: string) {
  return signal.getSignalOutcomesAction(ticker)
}

export async function evaluateSignalOutcomesAction(
  ticker: string,
  snapshotId: string,
  ruleId: string,
  signalDate: string,
  initialPrice: number | null,
) {
  return signal.evaluateSignalOutcomesAction(ticker, snapshotId, ruleId, signalDate, initialPrice)
}

export async function getSignalAnalysisAction(ticker: string) {
  return signal.getSignalAnalysisAction(ticker)
}

export async function evaluateSignalAnalysisAction(input: unknown) {
  return signal.evaluateSignalAnalysisAction(input)
}

// History
export async function getUserHistoryAction(
  options?: Parameters<typeof history.getUserHistoryAction>[0],
) {
  return history.getUserHistoryAction(options)
}

export async function deleteHistoryAction(id: number) {
  return history.deleteHistoryAction(id)
}

// Market & Intelligence
export async function getStockData(
  ticker: string,
  options?: Parameters<typeof market.getStockData>[1],
) {
  return market.getStockData(ticker, options)
}

export async function createAnalysisAction(ticker: string, requestKey?: string) {
  return market.createAnalysisAction(ticker, requestKey)
}

export async function getLatestAnalysisAction(ticker: string) {
  return market.getLatestAnalysisAction(ticker)
}

export async function getRecentPublicSnapshotsAction(limit?: number) {
  return market.getRecentPublicSnapshotsAction(limit)
}

export async function analyzeTicker(ticker: string) {
  return market.analyzeTicker(ticker)
}

export async function getRecentAnomalies() {
  return market.getRecentAnomalies()
}

export async function runScreener(filters: Parameters<typeof market.runScreener>[0]) {
  return market.runScreener(filters)
}

export async function getMarketOverviewAction(
  options?: Parameters<typeof market.getMarketOverviewAction>[0],
) {
  return market.getMarketOverviewAction(options)
}

export async function runMarketScanAction(
  options?: Parameters<typeof market.runMarketScanAction>[0],
) {
  return market.runMarketScanAction(options)
}

export async function getResearchSnapshotAction(
  options: Parameters<typeof market.getResearchSnapshotAction>[0],
) {
  return market.getResearchSnapshotAction(options)
}

export async function getBrokerListAction() {
  return market.getBrokerListAction()
}

export async function getBrokerActivityAction(
  brokerCode: string,
  startDate?: string,
  endDate?: string,
  options?: Parameters<typeof market.getBrokerActivityAction>[3],
) {
  return market.getBrokerActivityAction(brokerCode, startDate, endDate, options)
}

export async function compareBrokersAction(
  codeA: string,
  codeB: string,
  startDate?: string,
  endDate?: string,
  options?: Parameters<typeof market.compareBrokersAction>[4],
) {
  return market.compareBrokersAction(codeA, codeB, startDate, endDate, options)
}

export async function saveScreenAction(
  title: string,
  filters: Record<string, unknown>,
  presetId?: string,
) {
  return market.saveScreenAction(title, filters, presetId)
}

export async function getSavedScreensAction() {
  return market.getSavedScreensAction()
}

export async function deleteSavedScreenAction(id: number) {
  return market.deleteSavedScreenAction(id)
}

export async function saveResearchNoteAction(
  ticker: string,
  snapshotId: string,
  thesis: string,
  invalidationTriggers?: string,
  watchMetrics?: Record<string, unknown>,
) {
  return market.saveResearchNoteAction(
    ticker,
    snapshotId,
    thesis,
    invalidationTriggers,
    watchMetrics,
  )
}

export async function getResearchNotesForTickerAction(ticker: string) {
  return market.getResearchNotesForTickerAction(ticker)
}

export async function getUserResearchNotesAction() {
  return market.getUserResearchNotesAction()
}

export async function diffSnapshotsAction(snapshotIdA: string, snapshotIdB: string) {
  return market.diffSnapshotsAction(snapshotIdA, snapshotIdB)
}

export async function getSnapshotsForTickerAction(ticker: string) {
  return market.getSnapshotsForTickerAction(ticker)
}
