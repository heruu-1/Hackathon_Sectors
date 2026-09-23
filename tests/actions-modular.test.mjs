import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

test('app/actions re-exports all domain actions cleanly for backward compatibility', () => {
  const rootDir = process.cwd()
  const actionsContent = fs.readFileSync(path.join(rootDir, 'app', 'actions.ts'), 'utf8')

  const expectedWatchlist = [
    'getWatchlist',
    'addToWatchlist',
    'updateWatchlistItem',
    'deleteWatchlistItem',
  ]
  const watchlistContent = fs.readFileSync(
    path.join(rootDir, 'app', 'actions', 'watchlist.ts'),
    'utf8',
  )
  for (const fn of expectedWatchlist) {
    assert.ok(
      actionsContent.includes(fn),
      `app/actions.ts must export ${fn} for backward compatibility`,
    )
    assert.ok(
      watchlistContent.includes(`export async function ${fn}`),
      `app/actions/watchlist.ts must define ${fn}`,
    )
  }

  const expectedAssistant = [
    'listConversationsAction',
    'getConversationAction',
    'deleteConversationAction',
  ]
  const assistantContent = fs.readFileSync(
    path.join(rootDir, 'app', 'actions', 'assistant.ts'),
    'utf8',
  )
  for (const fn of expectedAssistant) {
    assert.ok(
      actionsContent.includes(fn),
      `app/actions.ts must export ${fn} for backward compatibility`,
    )
    assert.ok(
      assistantContent.includes(`export async function ${fn}`),
      `app/actions/assistant.ts must define ${fn}`,
    )
  }

  const expectedRadar = ['getMarketRadarFeed', 'getRadarHistory', 'clearRadarHistory']
  const radarContent = fs.readFileSync(path.join(rootDir, 'app', 'actions', 'radar.ts'), 'utf8')
  for (const fn of expectedRadar) {
    assert.ok(
      actionsContent.includes(fn),
      `app/actions.ts must export ${fn} for backward compatibility`,
    )
    assert.ok(
      radarContent.includes(`export async function ${fn}`),
      `app/actions/radar.ts must define ${fn}`,
    )
  }

  const expectedSignal = [
    'getSignalOutcomesAction',
    'evaluateSignalOutcomesAction',
    'getSignalAnalysisAction',
    'evaluateSignalAnalysisAction',
  ]
  const signalContent = fs.readFileSync(path.join(rootDir, 'app', 'actions', 'signal.ts'), 'utf8')
  for (const fn of expectedSignal) {
    assert.ok(
      actionsContent.includes(fn),
      `app/actions.ts must export ${fn} for backward compatibility`,
    )
    assert.ok(
      signalContent.includes(`export async function ${fn}`),
      `app/actions/signal.ts must define ${fn}`,
    )
  }

  const expectedHistory = ['getUserHistoryAction', 'deleteHistoryAction']
  const historyContent = fs.readFileSync(path.join(rootDir, 'app', 'actions', 'history.ts'), 'utf8')
  for (const fn of expectedHistory) {
    assert.ok(
      actionsContent.includes(fn),
      `app/actions.ts must export ${fn} for backward compatibility`,
    )
    assert.ok(
      historyContent.includes(`export async function ${fn}`),
      `app/actions/history.ts must define ${fn}`,
    )
  }

  const expectedMarket = [
    'getStockData',
    'createAnalysisAction',
    'getLatestAnalysisAction',
    'getRecentPublicSnapshotsAction',
    'analyzeTicker',
    'getRecentAnomalies',
    'runScreener',
    'getMarketOverviewAction',
    'runMarketScanAction',
    'getResearchSnapshotAction',
    'getBrokerListAction',
    'getBrokerActivityAction',
    'compareBrokersAction',
    'saveScreenAction',
    'getSavedScreensAction',
    'deleteSavedScreenAction',
    'saveResearchNoteAction',
    'getResearchNotesForTickerAction',
    'getUserResearchNotesAction',
    'diffSnapshotsAction',
    'getSnapshotsForTickerAction',
  ]
  const marketContent = fs.readFileSync(path.join(rootDir, 'app', 'actions', 'market.ts'), 'utf8')
  for (const fn of expectedMarket) {
    assert.ok(
      actionsContent.includes(fn),
      `app/actions.ts must export ${fn} for backward compatibility`,
    )
    assert.ok(
      marketContent.includes(`export async function ${fn}`) ||
        marketContent.includes(`export function ${fn}`),
      `app/actions/market.ts must define ${fn}`,
    )
  }
})
