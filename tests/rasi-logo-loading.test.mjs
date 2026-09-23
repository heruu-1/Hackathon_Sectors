import test from 'node:test'
import assert from 'node:assert/strict'

// Verify constellation nodes & path integrity for RASI identity
import {
  RASI_CONSTELLATION_NODES,
  RASI_SATELLITE_NODES,
  RASI_PATH_D,
} from '../components/logo/constants.ts'

test('RASI Brand Identity - S-Constellation geometry', async (t) => {
  await t.test('has 9 constellation nodes tracing the abstract S', () => {
    assert.equal(RASI_CONSTELLATION_NODES.length, 9)
  })

  await t.test('contains exactly 1 focal primary star node (breakout pivot)', () => {
    const primaryNodes = RASI_CONSTELLATION_NODES.filter((n) => n.isPrimary)
    assert.equal(primaryNodes.length, 1)
    assert.equal(primaryNodes[0].id, 'n4')
    assert.equal(primaryNodes[0].x, 46)
    assert.equal(primaryNodes[0].y, 60)
  })

  await t.test('all nodes have positive coordinates and radii', () => {
    for (const node of RASI_CONSTELLATION_NODES) {
      assert.ok(node.x > 0 && node.x < 100, `node.x within bounds: ${node.x}`)
      assert.ok(node.y > 0 && node.y < 120, `node.y within bounds: ${node.y}`)
      assert.ok(node.r >= 3, `node.r >= 3: ${node.r}`)
    }
  })

  await t.test('satellite nodes are defined', () => {
    assert.equal(RASI_SATELLITE_NODES.length, 3)
  })

  await t.test('RASI_PATH_D begins and ends at valid endpoints of the S curve', () => {
    assert.ok(RASI_PATH_D.startsWith('M 76 20'))
    assert.ok(RASI_PATH_D.endsWith('22 98'))
  })
})
