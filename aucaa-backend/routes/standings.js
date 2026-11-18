const router = require('express').Router()
const db = require('../config/db')
const { authMiddleware, adminOnly } = require('../middleware/auth')

const getStandingsForLeague = async (leagueId) => {
  const [rows] = await db.query(`
    SELECT
      t.team_id,
      t.team_name,
      t.league_id,
      COUNT(CASE WHEN (g.home_team_id = t.team_id AND g.home_score > g.away_score)
                  OR (g.away_team_id = t.team_id AND g.away_score > g.home_score)
                 THEN 1 END) AS wins,
      COUNT(CASE WHEN (g.home_team_id = t.team_id AND g.home_score < g.away_score)
                  OR (g.away_team_id = t.team_id AND g.away_score < g.home_score)
                 THEN 1 END) AS losses,
      COALESCE(SUM(CASE WHEN g.home_team_id = t.team_id THEN g.home_score
                        WHEN g.away_team_id = t.team_id THEN g.away_score END), 0) AS points_for,
      COALESCE(SUM(CASE WHEN g.home_team_id = t.team_id THEN g.away_score
                        WHEN g.away_team_id = t.team_id THEN g.home_score END), 0) AS points_against,
      COALESCE(SUM(CASE WHEN g.home_team_id = t.team_id THEN g.home_score - g.away_score
                        WHEN g.away_team_id = t.team_id THEN g.away_score - g.home_score END), 0) AS point_diff,
      ROUND(
        COUNT(CASE WHEN (g.home_team_id = t.team_id AND g.home_score > g.away_score)
                    OR (g.away_team_id = t.team_id AND g.away_score > g.home_score)
                   THEN 1 END) /
        NULLIF(COUNT(CASE WHEN g.status = 'completed' AND (g.home_team_id = t.team_id OR g.away_team_id = t.team_id) THEN 1 END), 0),
      3) AS win_pct
    FROM teams t
    LEFT JOIN games g ON (g.home_team_id = t.team_id OR g.away_team_id = t.team_id)
      AND g.status = 'completed'
    WHERE t.league_id = ?
    GROUP BY t.team_id, t.team_name, t.league_id
    ORDER BY wins DESC, point_diff DESC, points_for DESC, points_against ASC, team_name ASC
  `, [leagueId])
  return rows
}

const findExactTies = (standings) => {
  const groups = []
  let currentGroup = []

  for (let i = 0; i < standings.length; i++) {
    const team = standings[i]
    const prev = standings[i - 1]
    const tiedWithPrev = prev &&
      team.wins === prev.wins &&
      team.point_diff === prev.point_diff &&
      team.points_for === prev.points_for &&
      team.points_against === prev.points_against

    if (tiedWithPrev) {
      if (!currentGroup.length) currentGroup = [prev]
      currentGroup.push(team)
    } else {
      if (currentGroup.length > 1) groups.push(currentGroup)
      currentGroup = []
    }
  }

  if (currentGroup.length > 1) groups.push(currentGroup)
  return groups
}

router.post('/:leagueId/tiebreakers', authMiddleware, adminOnly, async (req, res) => {
  try {
    const leagueId = req.params.leagueId
    const standings = await getStandingsForLeague(leagueId)
    const tiedGroups = findExactTies(standings)

    if (!tiedGroups.length) {
      return res.status(200).json({ message: 'No exact tie groups found for tie-breaker games.', created: [] })
    }

    const createdGames = []
    for (const group of tiedGroups) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const teamA = group[i]
          const teamB = group[j]
          const [existing] = await db.query(
            `SELECT game_id FROM games WHERE league_id = ? AND ((home_team_id = ? AND away_team_id = ?) OR (home_team_id = ? AND away_team_id = ?)) AND venue = 'Tie-breaker'`,
            [leagueId, teamA.team_id, teamB.team_id, teamB.team_id, teamA.team_id]
          )
          if (existing.length > 0) continue

          const [result] = await db.query(
            'INSERT INTO games (league_id, home_team_id, away_team_id, status, venue, scheduled_time) VALUES (?, ?, ?, ?, ?, NULL)',
            [leagueId, teamA.team_id, teamB.team_id, 'upcoming', 'Tie-breaker']
          )
          createdGames.push({
            game_id: result.insertId,
            league_id: Number(leagueId),
            home_team_id: teamA.team_id,
            away_team_id: teamB.team_id,
            status: 'upcoming',
            venue: 'Tie-breaker'
          })
        }
      }
    }

    res.status(201).json({ message: 'Tie-breaker games created.', created: createdGames })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to create tie-breaker games.' })
  }
})

// GET /api/standings/:leagueId
router.get('/:leagueId', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        sv.*,
        (sv.wins + sv.losses) AS games_played,
        CASE WHEN (sv.wins + sv.losses) > 0
          THEN ROUND(sv.points_for / (sv.wins + sv.losses), 1)
          ELSE 0
        END AS avg_points,
        (
          SELECT COUNT(*) + 1
          FROM standings_view sv2
          WHERE sv2.league_id = sv.league_id
            AND (
              sv2.wins > sv.wins
              OR (sv2.wins = sv.wins AND sv2.point_diff > sv.point_diff)
              OR (sv2.wins = sv.wins AND sv2.point_diff = sv.point_diff AND sv2.points_for > sv.points_for)
              OR (sv2.wins = sv.wins AND sv2.point_diff = sv.point_diff AND sv2.points_for = sv.points_for AND sv2.points_against < sv.points_against)
              OR (sv2.wins = sv.wins AND sv2.point_diff = sv.point_diff AND sv2.points_for = sv.points_for AND sv2.points_against = sv.points_against AND sv2.team_name < sv.team_name)
            )
        ) AS standing_rank
      FROM standings_view sv
      WHERE sv.league_id = ?
      ORDER BY sv.wins DESC, sv.point_diff DESC, sv.points_for DESC, sv.points_against ASC, sv.team_name ASC
    `, [req.params.leagueId])
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch standings.' })
  }
})

module.exports = router
