import assert from 'node:assert/strict'
import { test } from 'node:test'

// In-memory simulation of repository operations to verify account isolation rules
class MockWatchlistRepo {
  constructor() {
    this.items = []
    this.nextId = 1
  }

  getUserWatchlist(userId) {
    return this.items.filter((item) => item.userId === userId)
  }

  getWatchlistItem(userId, ticker) {
    return this.items.find((item) => item.userId === userId && item.ticker === ticker) ?? null
  }

  upsertWatchlistItem(userId, input) {
    const cleanTicker = input.ticker.trim().toUpperCase().replace(/\.JK$/i, '')
    const existing = this.getWatchlistItem(userId, cleanTicker)
    if (existing) {
      existing.notes = input.notes !== undefined ? input.notes : existing.notes
      existing.targetPrice =
        input.targetPrice !== undefined ? input.targetPrice : existing.targetPrice
      existing.priority = input.priority ?? existing.priority
      existing.status = input.status ?? existing.status
      return { ...existing }
    }
    const newItem = {
      id: this.nextId++,
      userId,
      ticker: cleanTicker,
      name: input.name ?? cleanTicker,
      targetPrice: input.targetPrice ?? null,
      notes: input.notes ?? null,
      priority: input.priority ?? 'MEDIUM',
      status: input.status ?? 'WATCHING',
    }
    this.items.push(newItem)
    return { ...newItem }
  }

  updateWatchlistItem(userId, id, input) {
    const item = this.items.find((i) => i.id === id && i.userId === userId)
    if (!item) return null
    if (input.targetPrice !== undefined) item.targetPrice = input.targetPrice
    if (input.notes !== undefined) item.notes = input.notes
    if (input.priority !== undefined) item.priority = input.priority
    if (input.status !== undefined) item.status = input.status
    return { ...item }
  }

  deleteWatchlistItem(userId, id) {
    const idx = this.items.findIndex((i) => i.id === id && i.userId === userId)
    if (idx === -1) return false
    this.items.splice(idx, 1)
    return true
  }
}

class MockHistoryRepo {
  constructor() {
    this.history = []
    this.nextId = 1
  }

  getUserHistory(userId, options = {}) {
    let list = this.history.filter((h) => h.userId === userId)
    if (options.ticker) {
      list = list.filter((h) => h.ticker === options.ticker)
    }
    return { items: list, total: list.length }
  }

  addHistoryEntry(userId, snapshotId, ticker) {
    const entry = {
      id: this.nextId++,
      userId,
      snapshotId,
      ticker,
    }
    this.history.push(entry)
    return entry.id
  }

  deleteHistoryEntry(userId, id) {
    const idx = this.history.findIndex((h) => h.id === id && h.userId === userId)
    if (idx === -1) return false
    this.history.splice(idx, 1)
    return true
  }
}

class MockConversationRepo {
  constructor() {
    this.conversations = []
  }

  getUserConversations(userId) {
    return this.conversations.filter((c) => c.userId === userId)
  }

  getConversation(userId, conversationId) {
    return this.conversations.find((c) => c.id === conversationId && c.userId === userId) ?? null
  }

  deleteConversation(userId, conversationId) {
    const idx = this.conversations.findIndex((c) => c.id === conversationId && c.userId === userId)
    if (idx === -1) return false
    this.conversations.splice(idx, 1)
    return true
  }
}

test('Watchlist Isolation: Account A and B data is strictly partitioned', () => {
  const repo = new MockWatchlistRepo()
  const userA = 'user-a-uuid'
  const userB = 'user-b-uuid'

  // User A adds BBCA
  repo.upsertWatchlistItem(userA, {
    ticker: 'BBCA',
    name: 'BCA',
    targetPrice: 10000,
    notes: 'Catatan pribadi A',
  })

  // User B adds BBCA with different notes
  const itemB = repo.upsertWatchlistItem(userB, {
    ticker: 'BBCA',
    name: 'BCA',
    targetPrice: 9000,
    notes: 'Catatan pribadi B',
  })

  assert.equal(repo.getUserWatchlist(userA).length, 1)
  assert.equal(repo.getUserWatchlist(userB).length, 1)
  assert.equal(repo.getUserWatchlist(userA)[0].notes, 'Catatan pribadi A')
  assert.equal(repo.getUserWatchlist(userB)[0].notes, 'Catatan pribadi B')

  // User A cannot update User B's item
  const updateAttempt = repo.updateWatchlistItem(userA, itemB.id, {
    notes: 'Hacked note',
  })
  assert.equal(updateAttempt, null)
  assert.equal(repo.getUserWatchlist(userB)[0].notes, 'Catatan pribadi B')

  // User A cannot delete User B's item
  const deleteAttempt = repo.deleteWatchlistItem(userA, itemB.id)
  assert.equal(deleteAttempt, false)
  assert.equal(repo.getUserWatchlist(userB).length, 1)

  // Re-adding BBCA by User A without notes preserves existing notes
  repo.upsertWatchlistItem(userA, {
    ticker: 'BBCA',
    targetPrice: 10500,
  })
  assert.equal(repo.getUserWatchlist(userA)[0].notes, 'Catatan pribadi A')
  assert.equal(repo.getUserWatchlist(userA)[0].targetPrice, 10500)
})

test('History Isolation: Account A cannot read or delete Account B history', () => {
  const repo = new MockHistoryRepo()
  const userA = 'user-a-uuid'
  const userB = 'user-b-uuid'

  repo.addHistoryEntry(userA, 'snap-1', 'BBCA')
  const entryB = repo.addHistoryEntry(userB, 'snap-2', 'BBRI')

  assert.equal(repo.getUserHistory(userA).total, 1)
  assert.equal(repo.getUserHistory(userB).total, 1)

  // User A cannot delete User B's entry
  const deleteAttempt = repo.deleteHistoryEntry(userA, entryB)
  assert.equal(deleteAttempt, false)
  assert.equal(repo.getUserHistory(userB).total, 1)
})

test('Conversation Isolation: Account A cannot view or delete Account B conversation', () => {
  const repo = new MockConversationRepo()
  const userA = 'user-a-uuid'
  const userB = 'user-b-uuid'

  repo.conversations.push({
    id: 'conv-b-123',
    userId: userB,
    title: 'Analisis B',
  })

  assert.equal(repo.getConversation(userA, 'conv-b-123'), null)
  assert.notEqual(repo.getConversation(userB, 'conv-b-123'), null)

  const deleteAttempt = repo.deleteConversation(userA, 'conv-b-123')
  assert.equal(deleteAttempt, false)
  assert.notEqual(repo.getConversation(userB, 'conv-b-123'), null)
})
