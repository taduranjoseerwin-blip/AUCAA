import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

let socket = null

export function useSocket() {
  if (!socket) {
    socket = io('http://localhost:5000', {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
    })
  }
  return socket
}

// Hook to join a specific game room and listen for score updates
export function useGameSocket(gameId, onScoreUpdate, onStatusUpdate) {
  const socket = useSocket()
  const scoreUpdateRef = useRef(onScoreUpdate)
  const statusUpdateRef = useRef(onStatusUpdate)

  scoreUpdateRef.current = onScoreUpdate
  statusUpdateRef.current = onStatusUpdate

  useEffect(() => {
    if (!gameId) return

    socket.emit('joinGame', gameId)

    const handleScoreUpdate = (data) => {
      if (Number(data.gameId) === Number(gameId)) scoreUpdateRef.current?.(data)
    }

    const handleStatusUpdate = (data) => {
      if (Number(data.gameId) === Number(gameId)) statusUpdateRef.current?.(data)
    }

    socket.on('scoreUpdate', handleScoreUpdate)
    socket.on('statusUpdate', handleStatusUpdate)

    return () => {
      socket.emit('leaveGame', gameId)
      socket.off('scoreUpdate', handleScoreUpdate)
      socket.off('statusUpdate', handleStatusUpdate)
    }
  }, [gameId])
}