const router = require('express').Router()
const db = require('../config/db')
const { authMiddleware, adminOnly } = require('../middleware/auth')

// GET /api/bracket/:league_id — return bracket games for a league
router.get('/:league_id', async (req, res) => {
  const leagueId = req.params.league_id
  try {
    // Prefer returning games for the latest active bracket if the `brackets` table exists
    let bracketsSupported = true
    let activeBracket = null
    try {
      const [[ab]] = await db.query('SELECT * FROM brackets WHERE league_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1', [leagueId])
      activeBracket = ab
    } catch (e) {
      bracketsSupported = false
    }

    if (bracketsSupported) {
      // If we have brackets support and an active bracket, return those games.
      if (activeBracket && activeBracket.bracket_id) {
        const [rows] = await db.query(`
          SELECT g.*,
            ht.team_name AS home_team_name,
            at.team_name AS away_team_name
          FROM games g
          LEFT JOIN teams ht ON g.home_team_id = ht.team_id
          LEFT JOIN teams at ON g.away_team_id = at.team_id
          WHERE g.bracket_id = ?
          ORDER BY g.bracket_round ASC, g.bracket_slot ASC, g.scheduled_time ASC
        `, [activeBracket.bracket_id])
        return res.json(rows)
      }
      // brackets supported but no active bracket -> return empty
      return res.json([])
    }

    // Legacy fallback when brackets not supported
    const [rows] = await db.query(`
      SELECT g.*,
        ht.team_name AS home_team_name,
        at.team_name AS away_team_name
      FROM games g
      LEFT JOIN teams ht ON g.home_team_id = ht.team_id
      LEFT JOIN teams at ON g.away_team_id = at.team_id
      WHERE g.league_id = ? AND (g.bracket_round IS NOT NULL OR g.bracket_stage IS NOT NULL)
      ORDER BY g.bracket_round ASC, g.bracket_slot ASC, g.scheduled_time ASC
    `, [leagueId])
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch bracket.' })
  }
})

// POST /api/bracket/generate — admin only: generate single-elimination bracket
// body: { league_id, size }
router.post('/generate', authMiddleware, adminOnly, async (req, res) => {
  const { league_id, size } = req.body
  const leagueId = league_id
  const bracketSize = parseInt(size, 10) || 8
  if (!leagueId) return res.status(400).json({ message: 'league_id required.' })
  if (![2,4,8,16,32].includes(bracketSize)) return res.status(400).json({ message: 'Invalid bracket size (use 2,4,8,16,32).' })

  const [[league]] = await db.query('SELECT league_id, format FROM leagues WHERE league_id = ?', [leagueId])
  if (!league) return res.status(404).json({ message: 'League not found.' })
  if (league.format === 'round_robin') {
    return res.status(400).json({ message: 'Cannot generate elimination bracket for round robin league.' })
  }

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    // Create a new bracket record (soft-managed) when possible
    let bracketId = null
    try {
      const [bres] = await conn.query('INSERT INTO brackets (league_id, size, created_by) VALUES (?, ?, ?)', [leagueId, bracketSize, req.user?.id || null])
      bracketId = bres.insertId
      try {
        await conn.query('INSERT INTO bracket_audit (bracket_id, league_id, action, user_id, note) VALUES (?, ?, ?, ?, ?)', [bracketId, leagueId, 'create', req.user?.id || null, 'Bracket created via API'])
      } catch (e) { /* ignore audit failures */ }
    } catch (e) {
      // If brackets table isn't present, continue without bracket record
      bracketId = null
    }

    // Tidying up existing bracket markers for this league to avoid duplicates.
    // We nullify next_game_id first to avoid FK constraint issues, then clear bracket columns.
    await conn.query('UPDATE games SET next_game_id = NULL WHERE league_id = ? AND bracket_round IS NOT NULL', [leagueId])
    await conn.query('UPDATE games SET bracket_round = NULL, bracket_slot = NULL, winner_team_id = NULL, bracket_stage = NULL, next_game_id = NULL WHERE league_id = ? AND bracket_round IS NOT NULL', [leagueId])

    // fetch top seeds from standings_view; fall back to teams list if standings empty
    const [seeds] = await conn.query(
      `SELECT s.team_id, t.team_name FROM standings_view s JOIN teams t ON s.team_id = t.team_id WHERE s.league_id = ? ORDER BY CAST(s.wins AS SIGNED) DESC, CAST(s.point_diff AS SIGNED) DESC, CAST(s.points_for AS SIGNED) DESC, CAST(s.points_against AS SIGNED) ASC, s.team_name LIMIT ?`,
      [leagueId, bracketSize]
    )
    let seedList = seeds
    if (seedList.length < bracketSize) {
      const [fallback] = await conn.query('SELECT team_id, team_name FROM teams WHERE league_id = ? ORDER BY team_name LIMIT ?', [leagueId, bracketSize])
      if (fallback.length < bracketSize) {
        await conn.rollback()
        return res.status(400).json({ message: `Not enough teams for a ${bracketSize}-team bracket.` })
      }
      seedList = fallback
    }

    const rounds = Math.log2(bracketSize)
    const mapping = {} // mapping[round] = [{ slot, game_id }]

    const stageForRound = (roundNumber) => {
      const remaining = rounds - roundNumber + 1
      if (remaining === 1) return 'final'
      if (remaining === 2) return 'semifinal'
      if (remaining === 3) return 'quarterfinal'
      return null
    }

    // create games for each round (round 1 filled with seed matchups)
    for (let r = 1; r <= rounds; r++) {
      const numGames = bracketSize / Math.pow(2, r)
      mapping[r] = []
      const stage = stageForRound(r)
      for (let slot = 1; slot <= numGames; slot++) {
        let home = null
        let away = null
        if (r === 1) {
          const i = slot - 1
          home = seedList[i].team_id
          away = seedList[bracketSize - 1 - i].team_id
        }
        const [result] = await conn.query(
          'INSERT INTO games (league_id, home_team_id, away_team_id, status, bracket_round, bracket_slot, bracket_stage) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [leagueId, home, away, 'upcoming', r, slot, stage]
        )
        mapping[r].push({ slot, game_id: result.insertId })
      }
    }

    // wire next_game_id pointers
    for (let r = 1; r < rounds; r++) {
      for (const g of mapping[r]) {
        const nextSlot = Math.ceil(g.slot / 2)
        const nextGameId = mapping[r + 1].find(x => x.slot === nextSlot).game_id
        await conn.query('UPDATE games SET next_game_id = ? WHERE game_id = ?', [nextGameId, g.game_id])
      }
    }

    // If we created a brackets record and games table supports bracket_id, associate the created games
    if (bracketId) {
      try {
        for (let r = 1; r <= rounds; r++) {
          for (const g of mapping[r]) {
            await conn.query('UPDATE games SET bracket_id = ? WHERE game_id = ?', [bracketId, g.game_id])
          }
        }
      } catch (e) {
        // ignore if games.bracket_id doesn't exist
      }
    }

    await conn.commit()

    // return bracket games
    // Try to return games scoped to the new bracket when possible
    let bracketRows = []
    try {
      if (bracketId) {
        const [rows] = await db.query(`
          SELECT g.*,
            ht.team_name AS home_team_name,
            at.team_name AS away_team_name
          FROM games g
          LEFT JOIN teams ht ON g.home_team_id = ht.team_id
          LEFT JOIN teams at ON g.away_team_id = at.team_id
          WHERE g.bracket_id = ?
          ORDER BY g.bracket_round ASC, g.bracket_slot ASC
        `, [bracketId])
        bracketRows = rows
      }
    } catch (e) {
      bracketRows = []
    }
    if (!bracketRows.length) {
      const [rows] = await db.query(`
        SELECT g.*,
          ht.team_name AS home_team_name,
          at.team_name AS away_team_name
        FROM games g
        LEFT JOIN teams ht ON g.home_team_id = ht.team_id
        LEFT JOIN teams at ON g.away_team_id = at.team_id
        WHERE g.league_id = ? AND g.bracket_round IS NOT NULL
        ORDER BY g.bracket_round ASC, g.bracket_slot ASC
      `, [leagueId])
      bracketRows = rows
    }
    // emit socket event so frontends can update
    try {
      const io = req.app?.get('io')
      if (io) io.emit('bracketUpdated', { league_id: leagueId, games: bracketRows })
    } catch (e) { console.warn('Failed to emit bracketUpdated', e) }

    res.status(201).json({ message: 'Bracket generated.', games: bracketRows })
  } catch (err) {
    console.error(err)
    try { await conn.rollback() } catch (e) {}
    res.status(500).json({ message: 'Failed to generate bracket.' })
  } finally {
    try { conn.release() } catch (e) {}
  }
})

// PUT /api/bracket/:game_id/advance — admin: set winner and advance to next_game
router.put('/:game_id/advance', authMiddleware, adminOnly, async (req, res) => {
  const gameId = req.params.game_id
  try {
    const [[game]] = await db.query('SELECT * FROM games WHERE game_id = ?', [gameId])
    if (!game) return res.status(404).json({ message: 'Game not found.' })
    if (game.home_score == null || game.away_score == null) return res.status(400).json({ message: 'Scores not set.' })
    if (game.home_score === game.away_score) return res.status(400).json({ message: 'Tie scores — cannot determine winner.' })

    const winner = game.home_score > game.away_score ? game.home_team_id : game.away_team_id

    // update current game winner
    await db.query('UPDATE games SET winner_team_id = ?, status = ? WHERE game_id = ?', [winner, 'completed', gameId])

    if (game.next_game_id) {
      const [[nextGame]] = await db.query('SELECT * FROM games WHERE game_id = ?', [game.next_game_id])
      if (nextGame) {
        // convention: odd slot -> becomes home, even -> becomes away
        const placeAs = (game.bracket_slot % 2 === 1) ? 'home_team_id' : 'away_team_id'
        await db.query(`UPDATE games SET ${placeAs} = ? WHERE game_id = ?`, [winner, nextGame.game_id])
        // if both teams are set on next game, set status scheduled
        const [[updatedNext]] = await db.query('SELECT home_team_id, away_team_id FROM games WHERE game_id = ?', [nextGame.game_id])
        if (updatedNext.home_team_id && updatedNext.away_team_id) {
          await db.query('UPDATE games SET status = ? WHERE game_id = ?', ['upcoming', nextGame.game_id])
        }
      }
    }

    // emit socket event to notify frontends of change
    try {
      // Prefer emitting games for the active (non-deleted) bracket if present
      let bracketRows = []
      try {
        const [[activeBracket]] = await db.query('SELECT * FROM brackets WHERE league_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1', [game.league_id])
        if (activeBracket && activeBracket.bracket_id) {
          const [rows] = await db.query(`
            SELECT g.*,
              ht.team_name AS home_team_name,
              at.team_name AS away_team_name
            FROM games g
            LEFT JOIN teams ht ON g.home_team_id = ht.team_id
            LEFT JOIN teams at ON g.away_team_id = at.team_id
            WHERE g.bracket_id = ?
            ORDER BY g.bracket_round ASC, g.bracket_slot ASC
          `, [activeBracket.bracket_id])
          bracketRows = rows
        }
      } catch (e) { bracketRows = [] }
      if (!bracketRows.length) {
        const [rows] = await db.query(`
          SELECT g.*,
            ht.team_name AS home_team_name,
            at.team_name AS away_team_name
          FROM games g
          LEFT JOIN teams ht ON g.home_team_id = ht.team_id
          LEFT JOIN teams at ON g.away_team_id = at.team_id
          WHERE g.league_id = ? AND g.bracket_round IS NOT NULL
          ORDER BY g.bracket_round ASC, g.bracket_slot ASC
        `, [game.league_id])
        bracketRows = rows
      }
      const io = req.app?.get('io')
      if (io) io.emit('bracketUpdated', { league_id: game.league_id, games: bracketRows })
    } catch (e) { console.warn('Failed to emit bracketUpdated on advance', e) }

    res.json({ message: 'Winner set and advanced.', winner_team_id: winner })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to advance winner.' })
  }
})

// DELETE /api/bracket/:league_id/purge — admin: soft-delete latest bracket for a league when possible
router.delete('/:league_id/purge', authMiddleware, adminOnly, async (req, res) => {
  const leagueId = req.params.league_id
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    // Try to soft-delete latest bracket for this league when possible
    try {
      const [[activeBracket]] = await conn.query('SELECT * FROM brackets WHERE league_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1', [leagueId])
      if (activeBracket && activeBracket.bracket_id) {
        await conn.query('UPDATE brackets SET deleted_at = NOW() WHERE bracket_id = ?', [activeBracket.bracket_id])
        try {
          await conn.query('INSERT INTO bracket_audit (bracket_id, league_id, action, user_id, note) VALUES (?, ?, ?, ?, ?)', [activeBracket.bracket_id, leagueId, 'soft_delete', req.user?.id || null, 'Soft-deleted via API'])
        } catch (e) {}
        await conn.commit()
        try {
          const io = req.app?.get('io')
          if (io) io.emit('bracketUpdated', { league_id: Number(leagueId), games: [] })
        } catch (e) { console.warn('Failed to emit bracketUpdated on purge', e) }
        return res.json({ message: 'Bracket soft-deleted.', bracket_id: activeBracket.bracket_id })
      }
    } catch (e) {
      // Fall through to legacy hard-delete behavior if brackets table/row isn't available
    }

    // Legacy fallback: hard delete bracket-marked games
    await conn.query('UPDATE games SET next_game_id = NULL WHERE league_id = ? AND bracket_round IS NOT NULL', [leagueId])
    const [delResult] = await conn.query('DELETE FROM games WHERE league_id = ? AND bracket_round IS NOT NULL', [leagueId])
    await conn.commit()

    // Emit empty bracket update
    try {
      const io = req.app?.get('io')
      if (io) io.emit('bracketUpdated', { league_id: Number(leagueId), games: [] })
    } catch (e) { console.warn('Failed to emit bracketUpdated on purge', e) }

    res.json({ message: 'Bracket purged.', deleted: delResult.affectedRows })
  } catch (err) {
    console.error(err)
    try { await conn.rollback() } catch (e) {}
    res.status(500).json({ message: 'Failed to purge bracket.' })
  } finally {
    try { conn.release() } catch (e) {}
  }
})

// POST /api/bracket/restore/:bracket_id — admin: restore a soft-deleted bracket
router.post('/restore/:bracket_id', authMiddleware, adminOnly, async (req, res) => {
  const bracketId = req.params.bracket_id
  try {
    // ensure bracket exists
    const [[bracket]] = await db.query('SELECT * FROM brackets WHERE bracket_id = ?', [bracketId])
    if (!bracket) return res.status(404).json({ message: 'Bracket not found.' })
    if (bracket.deleted_at === null) return res.status(400).json({ message: 'Bracket is already active.' })

    await db.query('UPDATE brackets SET deleted_at = NULL WHERE bracket_id = ?', [bracketId])
    try { await db.query('INSERT INTO bracket_audit (bracket_id, league_id, action, user_id, note) VALUES (?, ?, ?, ?, ?)', [bracketId, bracket.league_id, 'restore', req.user?.id || null, 'Restored via API']) } catch (e) {}

    // fetch games for this bracket and emit update
    const [rows] = await db.query(`
      SELECT g.*,
        ht.team_name AS home_team_name,
        at.team_name AS away_team_name
      FROM games g
      LEFT JOIN teams ht ON g.home_team_id = ht.team_id
      LEFT JOIN teams at ON g.away_team_id = at.team_id
      WHERE g.bracket_id = ?
      ORDER BY g.bracket_round ASC, g.bracket_slot ASC
    `, [bracketId])
    try { const io = req.app?.get('io'); if (io) io.emit('bracketUpdated', { league_id: bracket.league_id, games: rows }) } catch (e) {}

    res.json({ message: 'Bracket restored.', bracket_id: bracketId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to restore bracket.' })
  }
})

module.exports = router


