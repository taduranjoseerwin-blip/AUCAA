import React from 'react'

const roundNameMap = {
  1: ['Final'],
  2: ['Semifinals', 'Final'],
  3: ['Quarterfinals', 'Semifinals', 'Final'],
  4: ['Round of 16', 'Quarterfinals', 'Semifinals', 'Final'],
  5: ['Round of 32', 'Round of 16', 'Quarterfinals', 'Semifinals', 'Final'],
}

export default function BracketSVG({ games }) {
  if (!games || games.length === 0) return null

  const roundsMap = {}
  games.forEach((g) => {
    const r = Number(g.bracket_round || 0)
    if (!roundsMap[r]) roundsMap[r] = []
    roundsMap[r].push(g)
  })

  const rounds = Object.keys(roundsMap).map(Number).sort((a, b) => a - b)
  if (rounds.length === 0) return null

  const maxRound = Math.max(...rounds)
  const cardWidth = 240
  const cardHeight = 78
  const gap = 24
  const padding = 32
  const colDistance = 280
  const rowBase = cardHeight + gap

  const roundLabels = roundNameMap[maxRound] || rounds.map((_, idx) => `Round ${idx + 1}`)

  const positions = {}
  rounds.forEach((roundNumber) => {
    const gamesInRound = roundsMap[roundNumber].slice().sort((a, b) => Number(a.bracket_slot || 0) - Number(b.bracket_slot || 0))
    const isFinal = roundNumber === maxRound
    const slotsPerSide = isFinal ? 1 : gamesInRound.length / 2

    gamesInRound.forEach((game) => {
      const slot = Number(game.bracket_slot || 0)
      const side = isFinal ? 'center' : slot <= slotsPerSide ? 'left' : 'right'
      const sideSlot = isFinal ? 1 : side === 'left' ? slot : slot - slotsPerSide
      const colIndex = isFinal ? maxRound - 1 : side === 'left' ? roundNumber - 1 : 2 * maxRound - roundNumber - 1
      const step = rowBase * Math.pow(2, maxRound - roundNumber)
      const y = padding + (2 * sideSlot - 1) * step / 2 - cardHeight / 2
      const x = padding + colIndex * colDistance
      positions[game.game_id] = { x, y, w: cardWidth, h: cardHeight, side, roundNumber }
    })
  })

  const width = Math.max(padding * 2 + (2 * maxRound - 1) * colDistance + cardWidth, 960)
  const height = Math.max(padding * 2 + rowBase * Math.pow(2, maxRound - 1) * 2 + 80, 520)

  const lines = games.reduce((acc, game) => {
    if (!game.next_game_id) return acc
    const from = positions[game.game_id]
    const to = positions[game.next_game_id]
    if (!from || !to) return acc

    const x1 = from.x + from.w
    const y1 = from.y + from.h / 2
    const x2 = to.x
    const y2 = to.y + to.h / 2
    const midX = x1 + 28
    const path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`
    acc.push({ path })
    return acc
  }, [])

  return (
    <div style={{ overflow: 'auto' }}>
      <svg width={width} height={height} style={{ display: 'block' }}>
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000" floodOpacity="0.12" />
          </filter>
        </defs>

        {Array.from({ length: 2 * maxRound - 1 }, (_, idx) => {
          const label = idx === maxRound - 1
            ? roundLabels[roundLabels.length - 1]
            : idx < maxRound - 1
            ? roundLabels[idx]
            : roundLabels[2 * maxRound - 2 - idx]
          return (
            <text
              key={`label-${idx}`}
              x={padding + idx * colDistance + cardWidth / 2}
              y={padding - 10}
              textAnchor="middle"
              style={{ fontSize: 13, fontWeight: 700, fill: '#7c88a2', letterSpacing: '0.08em', textTransform: 'uppercase' }}
            >
              {label}
            </text>
          )
        })}

        {lines.map((line, idx) => (
          <path key={`line-${idx}`} d={line.path} fill="none" stroke="#7C88A2" strokeWidth={2} strokeLinecap="round" />
        ))}

        {games.map((game) => {
          const pos = positions[game.game_id]
          if (!pos) return null
          const completed = game.status === 'completed' || !!game.winner_team_id
          const fill = completed ? '#ffffff' : '#0f172a'
          const stroke = completed ? '#cbd5e1' : '#334155'
          const titleColor = completed ? '#0f172a' : '#f8fafc'
          const muted = completed ? '#64748b' : '#94a3b8'

          return (
            <g key={game.game_id} transform={`translate(${pos.x}, ${pos.y})`}>
              <rect width={pos.w} height={pos.h} rx={16} ry={16} fill={fill} stroke={stroke} strokeWidth={1.2} filter={completed ? 'url(#shadow)' : ''} />
              <text x={18} y={26} style={{ fontSize: 11, fontWeight: 700, fill: muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {game.bracket_stage ? game.bracket_stage.replace('_', ' ') : pos.side === 'center' ? 'Final' : pos.side === 'left' ? `Left ${game.bracket_slot}` : `Right ${game.bracket_slot}`}
              </text>
              <text x={18} y={46} style={{ fontSize: 15, fontWeight: 700, fill: titleColor }}>{game.home_team_name || 'TBD'}</text>
              <text x={pos.w - 18} y={46} textAnchor="end" style={{ fontSize: 15, fontWeight: 700, fill: titleColor }}>{game.home_score != null ? game.home_score : '-'}</text>
              <line x1={18} y1={52} x2={pos.w - 18} y2={52} stroke={stroke} strokeWidth={1} opacity={0.18} />
              <text x={18} y={70} style={{ fontSize: 15, fontWeight: 700, fill: titleColor }}>{game.away_team_name || 'TBD'}</text>
              <text x={pos.w - 18} y={70} textAnchor="end" style={{ fontSize: 15, fontWeight: 700, fill: titleColor }}>{game.away_score != null ? game.away_score : '-'}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
