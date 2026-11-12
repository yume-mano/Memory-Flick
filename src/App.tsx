import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import './App.css'

type Direction = 'up' | 'down' | 'left' | 'right'
type Phase = 'ready' | 'showing' | 'playing' | 'result'

const directions: Direction[] = ['up', 'right', 'down', 'left']
const symbols: Record<Direction, string> = { up: '↑', right: '→', down: '↓', left: '←' }
const names: Record<Direction, string> = { up: '上', right: '右', down: '下', left: '左' }
const randomDirection = (): Direction => directions[Math.floor(Math.random() * directions.length)]

export default function App() {
  const [phase, setPhase] = useState<Phase>('ready')
  const [level, setLevel] = useState(1)
  const [sequence, setSequence] = useState<Direction[]>([])
  const [position, setPosition] = useState(0)
  const [shown, setShown] = useState<Direction | null>(null)
  const [message, setMessage] = useState('スタートを押して記憶力に挑戦！')
  const [best, setBest] = useState(() => {
    try { return Number(localStorage.getItem('memory-flick-best') || '0') } catch { return 0 }
  })
  const bestRef = useRef(best)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const phaseRef = useRef<Phase>('ready')
  const sequenceRef = useRef<Direction[]>([])
  const positionRef = useRef(0)
  const levelRef = useRef(1)

  function changePhase(next: Phase) { phaseRef.current = next; setPhase(next) }
  function clearTimers() { timers.current.forEach(clearTimeout); timers.current = [] }
  function later(fn: () => void, delay: number) { timers.current.push(setTimeout(fn, delay)) }

  function beginRound(nextLevel: number) {
    clearTimers()
    levelRef.current = nextLevel
    setLevel(nextLevel)
    const next = Array.from({ length: Math.min(nextLevel + 2, 12) }, randomDirection)
    sequenceRef.current = next
    setSequence(next)
    positionRef.current = 0
    setPosition(0)
    setShown(null)
    changePhase('showing')
    setMessage('矢印の順番を覚えてね！')
    next.forEach((direction, index) => {
      const speed = Math.max(430, 850 - nextLevel * 35)
      later(() => setShown(direction), 650 + index * speed)
      later(() => setShown(null), 650 + index * speed + speed * 0.7)
    })
    const speed = Math.max(430, 850 - nextLevel * 35)
    later(() => {
      setShown(null)
      changePhase('playing')
      setMessage('覚えた順番にフリック！')
    }, 650 + next.length * speed)
  }

  function submitDirection(direction: Direction) {
    if (phaseRef.current !== 'playing') return
    const current = positionRef.current
    if (sequenceRef.current[current] !== direction) {
      changePhase('result')
      setMessage(`残念！ 正解は「${names[sequenceRef.current[current]]}」でした`)
      return
    }
    const nextPosition = current + 1
    positionRef.current = nextPosition
    setPosition(nextPosition)
    if (nextPosition === sequenceRef.current.length) {
      const cleared = levelRef.current
      if (cleared > bestRef.current) {
        bestRef.current = cleared
        setBest(cleared)
        try { localStorage.setItem('memory-flick-best', String(cleared)) } catch { /* 保存できない環境でも遊べる */ }
      }
      changePhase('result')
      setMessage(`レベル ${cleared} クリア！ 🎉`)
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    pointerStart.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointerStart.current) return
    const dx = event.clientX - pointerStart.current.x
    const dy = event.clientY - pointerStart.current.y
    pointerStart.current = null
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 25) return
    submitDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'))
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mapping: Record<string, Direction> = {
        ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left',
        w: 'up', d: 'right', s: 'down', a: 'left',
      }
      if (mapping[event.key]) {
        event.preventDefault()
        submitDirection(mapping[event.key])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); clearTimers() }
  }, [])

  const won = phase === 'result' && position === sequence.length

  return (
    <main className="app-shell">
      <section className="game-card" aria-label="メモリーフリックゲーム">
        <div className="eyebrow">BRAIN TRAINING GAME</div>
        <h1>MEMORY <span>FLICK</span></h1>
        <p className="subtitle">見て、覚えて、フリック！</p>

        <div className="stats">
          <div><span>LEVEL</span><strong>{level}</strong></div>
          <div><span>BEST</span><strong>{best}</strong></div>
          <div><span>PROGRESS</span><strong>{position} / {sequence.length || 3}</strong></div>
        </div>

        <div className={`play-area ${phase === 'playing' ? 'active' : ''}`}
          onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { pointerStart.current = null }}>
          {phase === 'showing' ? (
            <><div className="stage-label">覚えてね</div><div className="big-arrow" aria-live="polite">{shown ? symbols[shown] : '·'}</div></>
          ) : phase === 'playing' ? (
            <><div className="stage-label">フリックして答えよう</div><div className="swipe-icon">✦</div><div className="hint">上下左右にスワイプ</div></>
          ) : (
            <><div className="stage-label">{phase === 'ready' ? '準備はいい？' : won ? 'おめでとう！' : 'ゲームオーバー'}</div><div className="swipe-icon">{phase === 'ready' ? '🧠' : won ? '🏆' : '💫'}</div></>
          )}
        </div>

        <p className="message" role="status">{message}</p>
        <div className="direction-grid" aria-label="方向入力ボタン">
          <button className="up" onClick={() => submitDirection('up')} disabled={phase !== 'playing'} aria-label="上">↑</button>
          <button className="left" onClick={() => submitDirection('left')} disabled={phase !== 'playing'} aria-label="左">←</button>
          <button className="down" onClick={() => submitDirection('down')} disabled={phase !== 'playing'} aria-label="下">↓</button>
          <button className="right" onClick={() => submitDirection('right')} disabled={phase !== 'playing'} aria-label="右">→</button>
        </div>

        {(phase === 'ready' || phase === 'result') && (
          <button className="primary-button" onClick={() => beginRound(phase === 'result' && won ? level + 1 : 1)}>
            {phase === 'ready' ? 'ゲームスタート' : won ? '次のレベルへ' : 'もう一度挑戦'}
          </button>
        )}
        {phase === 'showing' && <p className="footnote">表示が終わるまで待ってね</p>}
        {phase === 'playing' && <p className="footnote">PC：矢印キー / WASD / ボタン　スマホ：フリック / ボタン</p>}
      </section>
    </main>
  )
}
