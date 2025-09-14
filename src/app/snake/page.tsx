"use client"

import { useEffect, useRef, useState, useCallback } from "react"

interface Position {
  x: number
  y: number
}

interface Food {
  x: number
  y: number
  color: string
  id: string
}

interface GameState {
  snake: Position[]
  direction: Position
  food: Food[]
  score: number
  lives: number
  gameStatus: "menu" | "playing" | "paused" | "gameOver"
  inventory: string[]
  disposalSequence: string[]
  speed: number
  level: number
}

interface DisposalZone {
  x: number
  y: number
  width: number
  height: number
  requiredColor: string
  active: boolean
}

const COLORS = ["red", "blue", "green", "yellow", "orange", "purple"]
const GRID_SIZE = 20
const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600

export default function SnakePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<number | undefined>(undefined)
  const lastTimeRef = useRef<number>(0)
  const audioContextRef = useRef<AudioContext | undefined>(undefined)
  
  const [gameState, setGameState] = useState<GameState>({
    snake: [{ x: 400, y: 300 }],
    direction: { x: GRID_SIZE, y: 0 },
    food: [],
    score: 0,
    lives: 3,
    gameStatus: "menu",
    inventory: [],
    disposalSequence: [],
    speed: 150,
    level: 1
  })

  const [disposalZones, setDisposalZones] = useState<DisposalZone[]>([])

  // Generate disposal sequence
  const generateDisposalSequence = useCallback((level: number) => {
    const sequenceLength = Math.min(3 + Math.floor(level / 3), 6)
    const sequence = []
    for (let i = 0; i < sequenceLength; i++) {
      sequence.push(COLORS[Math.floor(Math.random() * COLORS.length)])
    }
    return sequence
  }, [])

  // Initialize disposal zones
  const initializeDisposalZones = useCallback(() => {
    const zones: DisposalZone[] = [
      { x: 50, y: 50, width: 100, height: 60, requiredColor: "", active: true },
      { x: 650, y: 50, width: 100, height: 60, requiredColor: "", active: true },
      { x: 50, y: 490, width: 100, height: 60, requiredColor: "", active: true },
      { x: 650, y: 490, width: 100, height: 60, requiredColor: "", active: true }
    ]
    return zones
  }, [])

  // Generate food
  const generateFood = useCallback((existing: Food[]): Food => {
    let x: number, y: number
    do {
      x = Math.floor(Math.random() * (CANVAS_WIDTH - 200) / GRID_SIZE) * GRID_SIZE + 100
      y = Math.floor(Math.random() * (CANVAS_HEIGHT - 200) / GRID_SIZE) * GRID_SIZE + 100
    } while (existing.some(f => f.x === x && f.y === y))
    
    return {
      x,
      y,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      id: Math.random().toString(36).substr(2, 9)
    }
  }, [])

  // Play sound effect
  const playSound = useCallback((frequency: number, duration: number = 100) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    
    const oscillator = audioContextRef.current.createOscillator()
    const gainNode = audioContextRef.current.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContextRef.current.destination)
    
    oscillator.frequency.value = frequency
    oscillator.type = 'square'
    
    gainNode.gain.setValueAtTime(0.1, audioContextRef.current.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + duration / 1000)
    
    oscillator.start(audioContextRef.current.currentTime)
    oscillator.stop(audioContextRef.current.currentTime + duration / 1000)
  }, [])

  // Start game
  const startGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      snake: [{ x: 400, y: 300 }],
      direction: { x: GRID_SIZE, y: 0 },
      food: [],
      score: 0,
      lives: 3,
      gameStatus: "playing",
      inventory: [],
      disposalSequence: generateDisposalSequence(1),
      speed: 150,
      level: 1
    }))
    setDisposalZones(initializeDisposalZones())
  }, [generateDisposalSequence, initializeDisposalZones])

  // Game over
  const gameOver = useCallback(() => {
    setGameState(prev => ({ ...prev, gameStatus: "gameOver" }))
    playSound(200, 500)
  }, [playSound])

  // Move snake
  const moveSnake = useCallback(() => {
    setGameState(prev => {
      if (prev.gameStatus !== "playing") return prev

      const newSnake = [...prev.snake]
      const head = { ...newSnake[0] }
      head.x += prev.direction.x
      head.y += prev.direction.y

      // Boundary collision
      if (head.x < 0 || head.x >= CANVAS_WIDTH || head.y < 0 || head.y >= CANVAS_HEIGHT) {
        gameOver()
        return prev
      }

      // Self collision
      if (newSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
        gameOver()
        return prev
      }

      newSnake.unshift(head)

      // Check food collision
      let newFood = [...prev.food]
      let newInventory = [...prev.inventory]
      let newScore = prev.score
      let foodEaten = false

      prev.food.forEach((food, index) => {
        if (head.x === food.x && head.y === food.y) {
          newInventory.push(food.color)
          newFood.splice(index, 1)
          newScore += 10
          foodEaten = true
          playSound(800, 150)
        }
      })

      if (!foodEaten) {
        newSnake.pop()
      }

      // Add new food
      while (newFood.length < Math.min(8, 3 + Math.floor(prev.level / 2))) {
        newFood.push(generateFood(newFood))
      }

      // Check disposal zone collision
      let newLives = prev.lives
      disposalZones.forEach(zone => {
        if (head.x >= zone.x && head.x < zone.x + zone.width &&
            head.y >= zone.y && head.y < zone.y + zone.height && 
            newInventory.length > 0) {
          
          const disposedColor = newInventory[0]
          const expectedColor = prev.disposalSequence[0]
          
          if (disposedColor === expectedColor) {
            // Correct disposal
            newInventory.shift()
            const newSequence = [...prev.disposalSequence]
            newSequence.shift()
            
            newScore += 25
            playSound(1200, 200)
            
            if (newSequence.length === 0) {
              // Sequence complete, generate new one
              return {
                ...prev,
                snake: newSnake,
                food: newFood,
                score: newScore,
                inventory: newInventory,
                disposalSequence: generateDisposalSequence(prev.level + 1),
                level: prev.level + 1,
                speed: Math.max(50, prev.speed - 10)
              }
            }
            
            return {
              ...prev,
              snake: newSnake,
              food: newFood,
              score: newScore,
              inventory: newInventory,
              disposalSequence: newSequence
            }
          } else {
            // Wrong disposal
            newLives--
            playSound(300, 400)
            if (newLives <= 0) {
              gameOver()
            }
          }
        }
      })

      return {
        ...prev,
        snake: newSnake,
        food: newFood,
        score: newScore,
        lives: newLives,
        inventory: newInventory
      }
    })
  }, [gameOver, playSound, generateFood, disposalZones, generateDisposalSequence])

  // Handle keyboard input
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (gameState.gameStatus === "menu" && e.code === "Space") {
      startGame()
      return
    }

    if (gameState.gameStatus === "gameOver" && e.code === "Space") {
      setGameState(prev => ({ ...prev, gameStatus: "menu" }))
      return
    }

    if (gameState.gameStatus === "playing") {
      let newDirection = { ...gameState.direction }
      
      switch (e.code) {
        case "ArrowUp":
        case "KeyW":
          if (gameState.direction.y === 0) newDirection = { x: 0, y: -GRID_SIZE }
          break
        case "ArrowDown":
        case "KeyS":
          if (gameState.direction.y === 0) newDirection = { x: 0, y: GRID_SIZE }
          break
        case "ArrowLeft":
        case "KeyA":
          if (gameState.direction.x === 0) newDirection = { x: -GRID_SIZE, y: 0 }
          break
        case "ArrowRight":
        case "KeyD":
          if (gameState.direction.x === 0) newDirection = { x: GRID_SIZE, y: 0 }
          break
        case "Space":
          setGameState(prev => ({ 
            ...prev, 
            gameStatus: prev.gameStatus === "playing" ? "paused" : "playing" 
          }))
          return
      }
      
      setGameState(prev => ({ ...prev, direction: newDirection }))
    }
  }, [gameState.gameStatus, gameState.direction, startGame])

  // Game loop
  const gameLoop = useCallback((currentTime: number) => {
    if (currentTime - lastTimeRef.current >= gameState.speed) {
      if (gameState.gameStatus === "playing") {
        moveSnake()
      }
      lastTimeRef.current = currentTime
    }
    gameLoopRef.current = requestAnimationFrame(gameLoop)
  }, [gameState.speed, gameState.gameStatus, moveSnake])

  // Render game
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = "rgb(17, 24, 39)"
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw disposal zones
    disposalZones.forEach((zone, index) => {
      ctx.fillStyle = "rgba(75, 85, 99, 0.3)"
      ctx.fillRect(zone.x, zone.y, zone.width, zone.height)
      
      ctx.strokeStyle = "rgb(156, 163, 175)"
      ctx.lineWidth = 2
      ctx.strokeRect(zone.x, zone.y, zone.width, zone.height)
      
      // Show required color
      if (gameState.disposalSequence[index]) {
        ctx.fillStyle = gameState.disposalSequence[index]
        ctx.fillRect(zone.x + 10, zone.y + 10, 30, 30)
        
        ctx.fillStyle = "white"
        ctx.font = "12px Inter"
        ctx.textAlign = "center"
        ctx.fillText(`#${index + 1}`, zone.x + 25, zone.y + 50)
      }
    })

    // Draw food
    gameState.food.forEach(food => {
      ctx.fillStyle = food.color
      ctx.fillRect(food.x, food.y, GRID_SIZE - 2, GRID_SIZE - 2)
      
      // Add glow effect
      ctx.shadowColor = food.color
      ctx.shadowBlur = 10
      ctx.fillRect(food.x + 2, food.y + 2, GRID_SIZE - 6, GRID_SIZE - 6)
      ctx.shadowBlur = 0
    })

    // Draw snake
    gameState.snake.forEach((segment, index) => {
      const alpha = index === 0 ? 1 : 0.8 - (index * 0.02)
      ctx.fillStyle = index === 0 ? "rgb(34, 197, 94)" : `rgba(34, 197, 94, ${alpha})`
      ctx.fillRect(segment.x, segment.y, GRID_SIZE - 2, GRID_SIZE - 2)
      
      if (index === 0) {
        // Draw snake head details
        ctx.fillStyle = "white"
        ctx.fillRect(segment.x + 6, segment.y + 4, 3, 3)
        ctx.fillRect(segment.x + 11, segment.y + 4, 3, 3)
      }
    })

    // Draw HUD
    ctx.fillStyle = "white"
    ctx.font = "20px Inter"
    ctx.textAlign = "left"
    ctx.fillText(`Score: ${gameState.score}`, 20, 30)
    ctx.fillText(`Lives: ${gameState.lives}`, 20, 60)
    ctx.fillText(`Level: ${gameState.level}`, 20, 90)

    // Draw inventory
    ctx.fillText("Inventory:", 200, 30)
    gameState.inventory.forEach((color, index) => {
      ctx.fillStyle = color
      ctx.fillRect(200 + index * 25, 40, 20, 20)
    })

    // Draw disposal sequence
    ctx.fillStyle = "white"
    ctx.fillText("Disposal Order:", 500, 30)
    gameState.disposalSequence.forEach((color, index) => {
      ctx.fillStyle = color
      ctx.fillRect(500 + index * 25, 40, 20, 20)
      ctx.strokeStyle = "white"
      ctx.strokeRect(500 + index * 25, 40, 20, 20)
      
      ctx.fillStyle = "white"
      ctx.font = "12px Inter"
      ctx.textAlign = "center"
      ctx.fillText((index + 1).toString(), 510 + index * 25, 75)
    })

    // Draw game status
    if (gameState.gameStatus === "menu") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      
      ctx.fillStyle = "white"
      ctx.font = "48px Inter"
      ctx.textAlign = "center"
      ctx.fillText("COLORFUL SNAKE", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 100)
      
      ctx.font = "24px Inter"
      ctx.fillText("Collect colored food and dispose in order!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 50)
      ctx.fillText("Use WASD or Arrow Keys to move", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
      ctx.fillText("Press SPACE to start", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50)
    }
    
    if (gameState.gameStatus === "paused") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)"
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      
      ctx.fillStyle = "white"
      ctx.font = "36px Inter"
      ctx.textAlign = "center"
      ctx.fillText("PAUSED", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
      ctx.font = "18px Inter"
      ctx.fillText("Press SPACE to continue", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40)
    }
    
    if (gameState.gameStatus === "gameOver") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      
      ctx.fillStyle = "white"
      ctx.font = "36px Inter"
      ctx.textAlign = "center"
      ctx.fillText("GAME OVER", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 50)
      
      ctx.font = "24px Inter"
      ctx.fillText(`Final Score: ${gameState.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
      ctx.fillText(`Level Reached: ${gameState.level}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30)
      
      ctx.font = "18px Inter"
      ctx.fillText("Press SPACE to return to menu", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 80)
    }
  }, [gameState, disposalZones])

  // Effects
  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [handleKeyPress])

  useEffect(() => {
    gameLoopRef.current = requestAnimationFrame(gameLoop)
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
      }
    }
  }, [gameLoop])

  useEffect(() => {
    render()
  }, [render])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-gray-800 p-4 rounded-lg shadow-2xl">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="border-2 border-gray-600 rounded-lg bg-gray-900"
          style={{ maxWidth: "100%", height: "auto" }}
        />
        <div className="mt-4 text-center text-sm text-gray-300">
          <p>Use WASD or Arrow Keys to move • SPACE to pause/unpause</p>
          <p>Collect colored food and dispose them in the correct order at disposal zones</p>
        </div>
      </div>
    </div>
  )
}