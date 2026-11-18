require('dotenv').config()
const bcrypt = require('bcryptjs')
const db = require('../config/db')

const suffix = '20260826'
const password = 'TempFlow@2026'

async function findOrCreateUser(connection, account) {
  const [existing] = await connection.query('SELECT id FROM users WHERE username = ?', [account.username])
  if (existing.length > 0) {
    await connection.query(
      'UPDATE users SET email = ?, password = ?, role = ?, parent_user_id = ?, status = ? WHERE id = ?',
      [account.email, account.password, account.role, account.parent_user_id || null, account.status, existing[0].id]
    )
    return existing[0].id
  }

  const [result] = await connection.query(
    'INSERT INTO users (username, email, password, role, parent_user_id, status) VALUES (?, ?, ?, ?, ?, ?)',
    [account.username, account.email, account.password, account.role, account.parent_user_id || null, account.status]
  )
  return result.insertId
}

async function findOrCreateCode(connection, code, role, parentUserId) {
  const [existing] = await connection.query('SELECT id FROM reg_codes WHERE code = ?', [code])
  if (existing.length === 0) {
    await connection.query(
      'INSERT INTO reg_codes (code, role, parent_user_id, used) VALUES (?, ?, ?, 0)',
      [code, role, parentUserId || null]
    )
  }
}

async function findOrCreateLeague(connection) {
  const [existing] = await connection.query('SELECT league_id FROM leagues WHERE name = ?', [`TEMP Flow League ${suffix}`])
  if (existing.length > 0) return existing[0].league_id

  const [result] = await connection.query(
    'INSERT INTO leagues (name, season, status, format) VALUES (?, ?, ?, ?)',
    [`TEMP Flow League ${suffix}`, '2026', 'upcoming', 'round_robin']
  )
  return result.insertId
}

async function findOrCreateTeam(connection, teamName, leagueId, coachId) {
  const [existing] = await connection.query('SELECT team_id FROM teams WHERE team_name = ?', [teamName])
  if (existing.length > 0) {
    await connection.query('UPDATE teams SET league_id = ?, coach_id = ? WHERE team_id = ?', [leagueId, coachId, existing[0].team_id])
    return existing[0].team_id
  }

  const [result] = await connection.query(
    'INSERT INTO teams (team_name, league_id, coach_id, division) VALUES (?, ?, ?, ?)',
    [teamName, leagueId, coachId, 'Open']
  )
  return result.insertId
}

async function findOrCreateRosterPlayer(connection, name, teamId, jerseyNumber) {
  const [existing] = await connection.query('SELECT player_id FROM players WHERE name = ?', [name])
  if (existing.length > 0) {
    await connection.query(
      'UPDATE players SET team_id = ?, verification_status = \'verified\', verified_at = NOW(), jersey_number = ?, position = \'Guard\' WHERE player_id = ?',
      [teamId, jerseyNumber, existing[0].player_id]
    )
    return existing[0].player_id
  }

  const [result] = await connection.query(
    'INSERT INTO players (name, team_id, verification_status, verified_at, jersey_number, position) VALUES (?, ?, \'verified\', NOW(), ?, \'Guard\')',
    [name, teamId, jerseyNumber]
  )
  return result.insertId
}

async function findOrCreateLiveGame(connection, leagueId, homeTeamId, awayTeamId) {
  const [existing] = await connection.query(
    'SELECT game_id FROM games WHERE league_id = ? AND home_team_id = ? AND away_team_id = ? AND status IN (\'live\', \'halftime\')',
    [leagueId, homeTeamId, awayTeamId]
  )
  if (existing.length > 0) return existing[0].game_id

  const [result] = await connection.query(
    'INSERT INTO games (league_id, home_team_id, away_team_id, scheduled_time, status, current_quarter) VALUES (?, ?, ?, NOW(), \'live\', 1)',
    [leagueId, homeTeamId, awayTeamId]
  )
  return result.insertId
}

async function seed() {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const hashedPassword = await bcrypt.hash(password, 10)

    const adminId = await findOrCreateUser(connection, {
      username: `temp_admin_${suffix}`,
      email: `temp.admin.${suffix}@example.com`,
      password: hashedPassword,
      role: 'admin',
      status: 'active'
    })
    const leagueManagerId = await findOrCreateUser(connection, {
      username: `temp_lm_${suffix}`,
      email: `temp.lm.${suffix}@example.com`,
      password: hashedPassword,
      role: 'league_manager',
      status: 'active'
    })
    const coachOneId = await findOrCreateUser(connection, {
      username: `temp_coach_1_${suffix}`,
      email: `temp.coach1.${suffix}@example.com`,
      password: hashedPassword,
      role: 'coach',
      parent_user_id: leagueManagerId,
      status: 'active'
    })
    const coachTwoId = await findOrCreateUser(connection, {
      username: `temp_coach_2_${suffix}`,
      email: `temp.coach2.${suffix}@example.com`,
      password: hashedPassword,
      role: 'coach',
      parent_user_id: leagueManagerId,
      status: 'active'
    })

    const leagueId = await findOrCreateLeague(connection)
    const teamOneId = await findOrCreateTeam(connection, `TEMP Team 1 ${suffix}`, leagueId, coachOneId)
    const teamTwoId = await findOrCreateTeam(connection, `TEMP Team 2 ${suffix}`, leagueId, coachTwoId)
    const gameId = await findOrCreateLiveGame(connection, leagueId, teamOneId, teamTwoId)

    for (let index = 1; index <= 5; index += 1) {
      await findOrCreateRosterPlayer(connection, `TEMP Home Player ${index} ${suffix}`, teamOneId, index)
      await findOrCreateRosterPlayer(connection, `TEMP Away Player ${index} ${suffix}`, teamTwoId, index + 5)
    }

    await findOrCreateCode(connection, `TEMP-COACH-1-${suffix}`, 'coach', leagueManagerId)
    await findOrCreateCode(connection, `TEMP-COACH-2-${suffix}`, 'coach', leagueManagerId)
    await findOrCreateCode(connection, `TEMP-PLAYER-1-${suffix}`, 'player', coachOneId)
    await findOrCreateCode(connection, `TEMP-PLAYER-2-${suffix}`, 'player', coachTwoId)

    const playerAccounts = [
      { username: `temp_player_1_${suffix}`, email: `temp.player1.${suffix}@example.com`, parent: coachOneId, team: teamOneId },
      { username: `temp_player_2_${suffix}`, email: `temp.player2.${suffix}@example.com`, parent: coachTwoId, team: teamTwoId }
    ]
    for (const [index, account] of playerAccounts.entries()) {
      const playerUserId = await findOrCreateUser(connection, {
        username: account.username,
        email: account.email,
        password: hashedPassword,
        role: 'player',
        parent_user_id: account.parent,
        status: 'pending'
      })
      const [players] = await connection.query('SELECT player_id FROM players WHERE user_id = ?', [playerUserId])
      if (players.length === 0) {
        await connection.query(
          'INSERT INTO players (name, user_id, team_id, verification_status, student_id, jersey_number, position) VALUES (?, ?, NULL, ?, ?, ?, ?)',
          [`TEMP Player ${index + 1} ${suffix}`, playerUserId, 'pending', `TEMP-${suffix}-${index + 1}`, index + 1, 'Guard']
        )
      } else {
        await connection.query(
          'UPDATE players SET team_id = NULL, verification_status = ?, verified_at = NULL WHERE player_id = ?',
          ['pending', players[0].player_id]
        )
      }
    }

    const [emailColumn] = await connection.query(
      'SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = \'users\' AND column_name = \'email_verified_at\''
    )
    if (Number(emailColumn[0].count) > 0) {
      await connection.query(
        'UPDATE users SET email_verified_at = NOW(), email_verification_token_hash = NULL, email_verification_expires_at = NULL WHERE username LIKE ?',
        [`temp_%_${suffix}`]
      )
    }

    await connection.commit()
    console.log(JSON.stringify({
      password,
      admin: `temp_admin_${suffix}`,
      league_manager: `temp_lm_${suffix}`,
      coaches: [`temp_coach_1_${suffix}`, `temp_coach_2_${suffix}`],
      players: [`temp_player_1_${suffix}`, `temp_player_2_${suffix}`],
      codes: {
        coach: [`TEMP-COACH-1-${suffix}`, `TEMP-COACH-2-${suffix}`],
        player: [`TEMP-PLAYER-1-${suffix}`, `TEMP-PLAYER-2-${suffix}`]
      },
      teams: [`TEMP Team 1 ${suffix}`, `TEMP Team 2 ${suffix}`],
      live_game_id: gameId,
      roster: '5 temporary verified players on each team for live scoring layout testing.',
      note: 'Players are pending so Admin Verification can be tested. Use the player codes to test new player registration.'
    }, null, 2))
  } catch (error) {
    await connection.rollback()
    console.error(error.message)
    process.exitCode = 1
  } finally {
    connection.release()
    await db.end()
  }
}

seed()