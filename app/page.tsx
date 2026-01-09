"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Play, Pause, History, Download, ArrowLeft, Delete, Check, RotateCw } from "lucide-react"

/**
 * Flash Number Trainer v1.1
 * 仕様書に基づき実装
 * - 単位は秒(s)で統一
 * - 個人情報入力なし
 * - 桁数はスライダーと±ボタンで同期
 */

// --- Constants & Defaults ---

const DEFAULT_SETTINGS = {
  mode: "sequence", // 'single' | 'sequence' (現在のUIではsequenceで桁数制御する形に統合)
  digits: 4,
  displaySec: 0.5,
  itiSec: 1.0,
  trialsPerSet: 5,
  numberRange: "0-9", // '0-9' | '1-9'
  answerMode: "keypad", // 'keypad' | 'none'
  feedback: true,
  feedbackSec: 1.0,
  recording: false,
}

const MIN_DIGITS = 1
const MAX_DIGITS = 8

// --- Utility Functions ---

const generateStimulus = (digits, range) => {
  let numStr = ""
  const minVal = range === "1-9" ? 1 : 0
  const maxVal = 9

  for (let i = 0; i < digits; i++) {
    // range='1-9'のときは全桁1-9
    const digit = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal
    numStr += digit.toString()
  }
  return numStr
}

const formatSec = (val) => `${Number(val).toFixed(2)}s`

// --- Components ---

// 1. Reusable UI Components
const Button = ({ children, onClick, variant = "primary", className = "", disabled = false, size = "md" }) => {
  const baseStyle =
    "flex items-center justify-center rounded-lg font-bold transition-all active:scale-95 disabled:opacity-50 disabled:scale-100 shadow-sm"
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-300",
    danger: "bg-red-100 text-red-700 hover:bg-red-200 border border-red-200",
    success: "bg-green-600 text-white hover:bg-green-700",
    outline: "bg-transparent border-2 border-blue-600 text-blue-600 hover:bg-blue-50",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100",
  }
  const sizes = {
    sm: "px-3 py-1.5 text-sm md:text-base landscape:py-1 landscape:text-sm",
    md: "px-4 py-2.5 text-base md:py-3 md:text-lg landscape:py-2 landscape:text-base",
    lg: "px-6 py-3 text-lg md:py-4 md:text-xl landscape:py-2.5 landscape:text-lg",
    xl: "px-8 py-4 text-xl md:py-5 md:text-2xl landscape:py-3 landscape:text-xl",
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}

const NumberControl = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit = "",
  helpText = "",
  normalizeValue = null,
  formatValue = null,
  stepStrategy = null,
}) => {
  const resolveStep = (currentValue, direction) => (stepStrategy ? stepStrategy(currentValue, direction) : step)
  const handleMinus = () => {
    const currentStep = resolveStep(value, "down")
    onChange(Math.max(min, Number((value - currentStep).toFixed(2))))
  }
  const handlePlus = () => {
    const currentStep = resolveStep(value, "up")
    onChange(Math.min(max, Number((value + currentStep).toFixed(2))))
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-2">
        <label className="font-bold text-gray-700 text-sm md:text-base">{label}</label>
        <span className="text-blue-600 font-mono font-bold bg-blue-50 px-2 py-1 rounded text-sm md:text-base">
          {typeof value === "number"
            ? formatValue
              ? formatValue(value)
              : typeof step === "number" && step < 1
                ? value.toFixed(2)
                : value
            : value}
          {unit}
        </span>
      </div>
      {helpText && <p className="text-xs text-gray-500 mb-2">{helpText}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={handleMinus}
          disabled={value <= min}
          className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold hover:bg-gray-300 disabled:opacity-30 text-lg md:text-xl"
        >
          −
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const nextValue = Number(e.target.value)
            onChange(normalizeValue ? normalizeValue(nextValue, value) : nextValue)
          }}
          className="flex-1 h-2.5 md:h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <button
          onClick={handlePlus}
          disabled={value >= max}
          className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold hover:bg-gray-300 disabled:opacity-30 text-lg md:text-xl"
        >
          ＋
        </button>
      </div>
    </div>
  )
}

// --- Main App Component ---

export default function FlashNumberTrainer() {
  // Global State
  const [view, setView] = useState("HOME") // HOME, SETTINGS, RUN, RESULT, HISTORY
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  // Session State
  const [sessionResults, setSessionResults] = useState([])
  const [currentHistory, setCurrentHistory] = useState([]) // 永続化された履歴

  // Initialize: Load settings and history
  useEffect(() => {
    const savedSettings = localStorage.getItem("fnt_settings")
    if (savedSettings) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) })
      } catch (e) {
        console.error("Settings load error", e)
      }
    }

    const savedHistory = localStorage.getItem("fnt_history")
    if (savedHistory) {
      try {
        setCurrentHistory(JSON.parse(savedHistory))
      } catch (e) {
        console.error("History load error", e)
      }
    }
  }, [])

  // Save settings on change
  useEffect(() => {
    localStorage.setItem("fnt_settings", JSON.stringify(settings))
  }, [settings])

  // Save history on change (only if recording is on, but we manage logic elsewhere)
  useEffect(() => {
    if (settings.recording) {
      localStorage.setItem("fnt_history", JSON.stringify(currentHistory))
    }
  }, [currentHistory, settings.recording])

  const handleStartRequest = () => {
    setView("SETTINGS")
  }

  const handleStartTraining = () => {
    setSessionResults([]) // Reset session
    setView("RUN")
  }

  const normalizeDisplaySec = (nextValue) => {
    if (nextValue <= 2) return Number(nextValue.toFixed(2))
    return Math.max(3, Math.round(nextValue))
  }

  const resolveDisplayStep = (currentValue, direction) => {
    if (currentValue > 2) return 1
    if (currentValue === 2 && direction === "up") return 1
    return 0.05
  }

  const formatDisplaySec = (value) => (value <= 2 ? value.toFixed(2) : value.toFixed(0))

  const handleHistoryClear = () => {
    if (window.confirm("履歴を全て消去しますか？")) {
      setCurrentHistory([])
      localStorage.removeItem("fnt_history")
    }
  }

  const exportCSV = () => {
    if (currentHistory.length === 0) return

    const headers = ["Date", "Digits", "DisplayTime(s)", "ITI(s)", "TotalTrials", "CorrectCount", "Score(%)"]
    const rows = currentHistory.map((h) => [
      new Date(h.timestamp).toLocaleString(),
      h.settings.digits,
      h.settings.displaySec,
      h.settings.itiSec,
      h.total,
      h.correct,
      Math.round((h.correct / h.total) * 100),
    ])

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `fnt_history_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // --- Sub-Screens ---

  const renderHome = () => (
    <div className="flex flex-col items-center justify-center min-h-[80vh] landscape:min-h-[70vh] p-6 md:p-8 landscape:p-4 text-center space-y-6 md:space-y-8 landscape:space-y-4 animate-fade-in">
      <div className="space-y-3 landscape:space-y-2">
        <div className="flex justify-center mb-4 landscape:mb-2">
          <img
            src="/icon.png"
            alt="Flash Number Trainer"
            className="w-24 h-24 md:w-40 md:h-40 lg:w-48 lg:h-48 landscape:w-20 landscape:h-20"
          />
        </div>
        <h1 className="text-4xl md:text-6xl lg:text-7xl landscape:text-3xl font-black text-blue-900 tracking-tight">
          Flash Number
          <span className="block text-blue-600 text-2xl md:text-3xl lg:text-4xl landscape:text-xl font-medium mt-2 landscape:mt-1">
            Trainer
          </span>
        </h1>
        <p className="text-gray-500 text-sm md:text-base lg:text-lg landscape:text-xs">
          注意・ワーキングメモリ訓練支援ツール
        </p>
      </div>

      <div className="w-full max-w-sm md:max-w-md space-y-3 md:space-y-4 landscape:space-y-2">
        <Button
          onClick={handleStartRequest}
          variant="primary"
          size="xl"
          className="w-full shadow-lg hover:shadow-xl transform transition-all"
        >
          <Play className="mr-2 w-6 h-6 md:w-8 md:h-8 landscape:w-5 landscape:h-5" /> 開始する
        </Button>

        {settings.recording && (
          <Button onClick={() => setView("HISTORY")} variant="secondary" size="md" className="w-full">
            <History className="mr-2 w-5 h-5 md:w-6 md:h-6 landscape:w-4 landscape:h-4" /> 履歴を見る
          </Button>
        )}
      </div>
      <p className="text-xs md:text-sm landscape:text-[10px] text-gray-400 absolute bottom-4 landscape:bottom-2">
        v1.1 | Login Free | Local Storage Only
      </p>
    </div>
  )

  const renderSettings = () => (
    <div className="max-w-lg md:max-w-2xl mx-auto p-4 md:p-6 pb-28 md:pb-32 animate-slide-up">
      <div className="flex items-center justify-center relative mb-6">
        <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-800">訓練設定</h2>
      </div>

      <div className="space-y-5 md:space-y-6">
        {/* 重要設定 */}
        <div className="space-y-4 md:space-y-5">
          <NumberControl
            label="桁数 (Digits)"
            value={settings.digits}
            min={MIN_DIGITS}
            max={MAX_DIGITS}
            step={1}
            onChange={(v) => setSettings({ ...settings, digits: v })}
          />

          <NumberControl
            label="表示時間 (Display)"
            value={settings.displaySec}
            min={0.05}
            max={10.0}
            step={0.05}
            unit="s"
            normalizeValue={(nextValue) => normalizeDisplaySec(nextValue)}
            formatValue={(value) => formatDisplaySec(value)}
            stepStrategy={(currentValue, direction) => resolveDisplayStep(currentValue, direction)}
            onChange={(v) => setSettings({ ...settings, displaySec: v })}
          />
        </div>

        {/* 詳細設定トグル (簡易実装として、常に表示しつつグループ分け) */}
        <details className="group bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <summary className="flex justify-between items-center font-medium cursor-pointer p-4 md:p-5 bg-gray-50 hover:bg-gray-100 text-gray-600 text-sm md:text-base">
            <span>詳細設定 (ITI, 回答方式, 記録など)</span>
            <span className="transition group-open:rotate-180">▼</span>
          </summary>
          <div className="p-4 md:p-5 space-y-4 md:space-y-5 border-t border-gray-100">
            <NumberControl
              label="問題間隔 (ITI)"
              value={settings.itiSec}
              min={0.0}
              max={3.0}
              step={0.5}
              unit="s"
              helpText="回答完了後、次の問題までの待ち時間"
              onChange={(v) => setSettings({ ...settings, itiSec: v })}
            />

            <NumberControl
              label="問題数 (1セット)"
              value={settings.trialsPerSet}
              min={1}
              max={20}
              step={1}
              onChange={(v) => setSettings({ ...settings, trialsPerSet: v })}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
              <div className="space-y-2">
                <label className="block text-sm md:text-base font-bold text-gray-700">数字範囲</label>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  {["0-9", "1-9"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setSettings({ ...settings, numberRange: opt })}
                      className={`flex-1 py-2 text-sm md:text-base rounded-md transition-all ${settings.numberRange === opt ? "bg-white shadow text-blue-700 font-bold" : "text-gray-500"}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm md:text-base font-bold text-gray-700">回答方式</label>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  {[
                    { id: "keypad", label: "入力" },
                    { id: "none", label: "口頭" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setSettings({ ...settings, answerMode: opt.id })}
                      className={`flex-1 py-2 text-sm md:text-base rounded-md transition-all ${settings.answerMode === opt.id ? "bg-white shadow text-blue-700 font-bold" : "text-gray-500"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <label className="text-gray-700 font-medium text-sm md:text-base">フィードバックを表示</label>
              <button
                onClick={() => setSettings({ ...settings, feedback: !settings.feedback })}
                className={`w-12 h-6 md:w-14 md:h-7 rounded-full transition-colors relative ${settings.feedback ? "bg-green-500" : "bg-gray-300"}`}
              >
                <div
                  className={`absolute top-1 left-1 bg-white w-4 h-4 md:w-5 md:h-5 rounded-full transition-transform ${settings.feedback ? "translate-x-6 md:translate-x-7" : ""}`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-2">
              <label className="text-gray-700 font-medium text-sm md:text-base">履歴を記録する</label>
              <button
                onClick={() => setSettings({ ...settings, recording: !settings.recording })}
                className={`w-12 h-6 md:w-14 md:h-7 rounded-full transition-colors relative ${settings.recording ? "bg-blue-500" : "bg-gray-300"}`}
              >
                <div
                  className={`absolute top-1 left-1 bg-white w-4 h-4 md:w-5 md:h-5 rounded-full transition-transform ${settings.recording ? "translate-x-6 md:translate-x-7" : ""}`}
                />
              </button>
            </div>
          </div>
        </details>
      </div>

      {/* フッターアクション */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 md:p-5 pb-safe z-10 flex gap-3 md:gap-4 max-w-lg md:max-w-2xl mx-auto">
        <Button onClick={() => setView("HOME")} variant="secondary" size="md" className="flex-1">
          戻る
        </Button>
        <Button onClick={handleStartTraining} variant="primary" size="md" className="flex-[2]">
          開始する
        </Button>
      </div>
    </div>
  )

  const renderHistory = () => (
    <div className="max-w-lg md:max-w-2xl mx-auto p-4 md:p-6 h-screen flex flex-col">
      <div className="flex items-center justify-between mb-4 md:mb-5">
        <button onClick={() => setView("HOME")} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 text-gray-600" />
        </button>
        <h2 className="text-lg md:text-xl lg:text-2xl font-bold">実施履歴</h2>
        <div className="w-9 md:w-10"></div>
      </div>

      <div className="flex-1 overflow-auto space-y-2 md:space-y-3 mb-4">
        {currentHistory.length === 0 ? (
          <div className="text-center text-gray-400 mt-20 text-sm md:text-base">履歴はありません</div>
        ) : (
          currentHistory
            .slice()
            .reverse()
            .map((h, i) => (
              <div key={i} className="bg-white p-3 md:p-4 rounded-lg border border-gray-200 text-sm md:text-base">
                <div className="flex justify-between text-gray-500 text-xs md:text-sm mb-1 md:mb-2">
                  <span>{new Date(h.timestamp).toLocaleString()}</span>
                  <span>{h.settings.mode === "sequence" ? "数字列" : "単発"}</span>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <span className="font-bold text-base md:text-xl text-blue-900">{h.settings.digits}桁</span>
                    <span className="ml-2 text-gray-600 text-xs md:text-sm">
                      {h.settings.displaySec}s / ITI {h.settings.itiSec}s
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-xl md:text-2xl font-bold text-gray-800">
                      {h.correct}
                      <span className="text-sm md:text-base text-gray-400">/{h.total}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button onClick={handleHistoryClear} variant="danger" size="sm">
          <Delete className="w-4 h-4 md:w-5 h-5 mr-1 md:mr-2" /> 全消去
        </Button>
        <Button onClick={exportCSV} variant="secondary" size="sm" disabled={currentHistory.length === 0}>
          <Download className="w-4 h-4 md:w-5 h-5 mr-1 md:mr-2" /> CSV出力
        </Button>
      </div>
    </div>
  )

  // --- Sub-renderers logic switch ---

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 select-none">
      <div className="mx-auto max-w-lg md:max-w-3xl lg:max-w-5xl min-h-screen bg-white sm:shadow-xl sm:my-0 sm:min-h-screen relative overflow-hidden">
        {view === "HOME" && renderHome()}
        {view === "SETTINGS" && renderSettings()}
        {view === "RUN" && (
          <RunSession
            settings={settings}
            onFinish={(results) => {
              setSessionResults(results)

              // 履歴保存ロジック
              if (settings.recording) {
                const correctCount = results.filter((r) => r.isCorrect).length
                const newRecord = {
                  timestamp: Date.now(),
                  settings: settings,
                  results: results, // 詳細も保存（必要であれば）
                  total: results.length,
                  correct: correctCount,
                }
                const newHistory = [...currentHistory, newRecord]
                setCurrentHistory(newHistory)
              }
              setView("RESULT")
            }}
            onAbort={() => setView("HOME")}
          />
        )}
        {view === "RESULT" && (
          <ResultScreen results={sessionResults} onNextSet={() => setView("SETTINGS")} onHome={() => setView("HOME")} />
        )}
        {view === "HISTORY" && renderHistory()}
      </div>
    </div>
  )
}

// --- Run Session Component (Complex Logic) ---

function RunSession({ settings, onFinish, onAbort }) {
  // Phases: PREP -> SHOW -> HIDE -> ANSWER -> FEEDBACK -> PREP (Loop)
  const [phase, setPhase] = useState("PREP")
  const [trialIndex, setTrialIndex] = useState(0)
  const [currentStimulus, setCurrentStimulus] = useState("")
  const [userInput, setUserInput] = useState("")
  const [results, setResults] = useState([])
  const [isPaused, setIsPaused] = useState(false)
  const [feedbackState, setFeedbackState] = useState(null) // 'correct' | 'incorrect' | 'verbal'

  const timerRef = useRef(null)

  // --- Stimulus font auto-fit (measured, never clip) ---
  const showBoxRef = useRef(null)
  const stimulusRef = useRef(null)
  const [stimulusStyle, setStimulusStyle] = useState({ fontSizePx: 120, letterSpacingEm: 0.1 })

  const fitStimulus = useCallback(() => {
    if (typeof window === "undefined") return
    const box = showBoxRef.current
    const text = stimulusRef.current
    if (!box || !text) return

    const digits = settings.digits

    // 桁数が多いほど詰める（切れ防止）
    const letterSpacingEm = Math.min(0.12, Math.max(0.02, 0.12 - digits * 0.012))

    // 使える幅/高さ（安全側）
    const boxRect = box.getBoundingClientRect()
    const availableW = boxRect.width * 0.96
    const availableH = boxRect.height * 0.92

    const MAX = 420
    const MIN = 40

    // まず最大で当てて測る → 比率で縮める
    text.style.fontSize = `${MAX}px`
    text.style.letterSpacing = `${letterSpacingEm}em`

    const textRect1 = text.getBoundingClientRect()
    if (textRect1.width === 0 || textRect1.height === 0) return

    const scale = Math.min(availableW / textRect1.width, availableH / textRect1.height, 1)
    let nextSize = Math.floor(MAX * scale)
    nextSize = Math.max(MIN, Math.min(MAX, nextSize))

    // 丸め誤差などでまだはみ出す場合の安全調整
    let safety = 0
    while (safety < 3) {
      text.style.fontSize = `${nextSize}px`
      const r = text.getBoundingClientRect()
      if (r.width <= availableW && r.height <= availableH) break
      nextSize = Math.max(MIN, nextSize - 2)
      safety += 1
    }

    setStimulusStyle({ fontSizePx: nextSize, letterSpacingEm })
  }, [settings.digits])

  // SHOWに入った直後＆刺激が変わった直後にフィット（レイアウト確定後）
  useEffect(() => {
    if (phase !== "SHOW") return
    const id = requestAnimationFrame(() => fitStimulus())
    return () => cancelAnimationFrame(id)
  }, [phase, currentStimulus, fitStimulus])

  // リサイズ/回転にも追従
  useEffect(() => {
    const box = showBoxRef.current
    if (!box) return

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => fitStimulus())
      ro.observe(box)
      window.addEventListener("orientationchange", fitStimulus)
      return () => {
        ro.disconnect()
        window.removeEventListener("orientationchange", fitStimulus)
      }
    } else {
      window.addEventListener("resize", fitStimulus)
      window.addEventListener("orientationchange", fitStimulus)
      return () => {
        window.removeEventListener("resize", fitStimulus)
        window.removeEventListener("orientationchange", fitStimulus)
      }
    }
  }, [fitStimulus])

  // --- Timer & Phase Management ---

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  const nextTrial = useCallback(() => {
    if (trialIndex + 1 >= settings.trialsPerSet) {
      onFinish(results)
    } else {
      setTrialIndex((prev) => prev + 1)
      setPhase("PREP")
    }
  }, [trialIndex, settings.trialsPerSet, results, onFinish])

  // --- Data Setup Effect ---
  useEffect(() => {
    const num = generateStimulus(settings.digits, settings.numberRange)
    setCurrentStimulus(num)
    setUserInput("")
    setFeedbackState(null)
    setPhase("PREP")
  }, [trialIndex, settings.digits, settings.numberRange])

  // --- Phase Timer Effect ---
  useEffect(() => {
    if (isPaused) return

    clearTimer()

    switch (phase) {
      case "PREP":
        timerRef.current = setTimeout(() => setPhase("SHOW"), 500)
        break

      case "SHOW":
        timerRef.current = setTimeout(() => {
          setPhase("HIDE")
        }, settings.displaySec * 1000)
        break

      case "HIDE":
        timerRef.current = setTimeout(() => {
          if (settings.answerMode === "none") {
            setResults((prev) => [
              ...prev,
              {
                trial: trialIndex + 1,
                stimulus: currentStimulus,
                input: "(None)",
                isCorrect: true,
                isVerbal: true,
                timestamp: Date.now(),
              },
            ])
            nextTrial()
          } else {
            setPhase("ANSWER")
          }
        }, settings.itiSec * 1000)
        break

      case "ANSWER":
        // Waiting for user input.
        break

      case "FEEDBACK":
        if (settings.feedback) {
          timerRef.current = setTimeout(() => {
            nextTrial()
          }, settings.feedbackSec * 1000)
        } else {
          timerRef.current = setTimeout(() => {
            nextTrial()
          }, 0)
        }
        break

      default:
        break
    }

    return () => clearTimer()
  }, [phase, isPaused, settings, trialIndex, nextTrial, currentStimulus])

  // --- Interactions ---

  const handleKeypad = (key) => {
    if (phase !== "ANSWER") return
    if (key === "DELETE") {
      setUserInput((prev) => prev.slice(0, -1))
    } else if (key === "CLEAR") {
      setUserInput("")
    } else {
      if (userInput.length < settings.digits) {
        setUserInput((prev) => prev + key)
      }
    }
  }

  const submitAnswer = (verbal = false) => {
    if (phase !== "ANSWER") return

    let isCorrect = false

    if (verbal) {
      isCorrect = true
    } else {
      isCorrect = userInput === currentStimulus
    }

    setResults((prev) => [
      ...prev,
      {
        trial: trialIndex + 1,
        stimulus: currentStimulus,
        input: verbal ? "(Verbal)" : userInput,
        isCorrect: isCorrect,
        isVerbal: verbal,
        timestamp: Date.now(),
      },
    ])

    if (settings.feedback) {
      setFeedbackState(verbal ? "verbal" : isCorrect ? "correct" : "incorrect")
      setPhase("FEEDBACK")
    } else {
      nextTrial()
    }
  }

  // --- UI Rendering ---

  const renderTopBar = () => (
    <div className="flex justify-between items-center px-4 md:px-6 py-3 bg-white border-b border-gray-200">
      <button onClick={onAbort} className="p-2 hover:bg-gray-100 rounded-full">
        <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 text-gray-600" />
      </button>
      <div className="text-center">
        <div className="text-xs text-gray-400">Trial</div>
        <div className="text-base md:text-lg font-bold text-gray-700">
          {trialIndex + 1}/{settings.trialsPerSet}
        </div>
      </div>
      <button
        onClick={() => setIsPaused(!isPaused)}
        className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30"
        disabled={phase !== "SHOW" && phase !== "HIDE"}
      >
        {isPaused ? (
          <Play className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
        ) : (
          <Pause className="w-5 h-5 md:w-6 md:h-6 text-gray-600" />
        )}
      </button>
    </div>
  )

  const renderMainArea = () => {
    if (phase === "SHOW") {
      return (
        <div
          ref={showBoxRef}
          className="flex-1 flex items-center justify-center animate-fade-in overflow-hidden px-2"
        >
          <div
            ref={stimulusRef}
            className="font-black text-blue-900 tabular-nums leading-none whitespace-nowrap"
            style={{
              fontSize: `${stimulusStyle.fontSizePx}px`,
              letterSpacing: `${stimulusStyle.letterSpacingEm}em`,
            }}
          >
            {currentStimulus}
          </div>
        </div>
      )
    }

    if (phase === "PREP" || phase === "HIDE") {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-4 h-4 md:w-5 md:h-5 landscape:w-3 landscape:h-3 bg-blue-600 rounded-full animate-pulse"></div>
        </div>
      )
    }

    if (phase === "ANSWER") {
      return (
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-start px-4 md:px-6 landscape:px-3 py-4 md:py-6 landscape:py-2">
          <div className="w-full max-w-md md:max-w-lg landscape:max-w-md">
            <div className="bg-gray-100 rounded-2xl landscape:rounded-xl p-4 md:p-6 landscape:p-3 mb-4 md:mb-6 landscape:mb-3 min-h-[60px] md:min-h-[80px] landscape:min-h-[60px] flex items-center justify-center">
              <div className="text-3xl md:text-5xl lg:text-6xl landscape:text-4xl font-black text-gray-700 tracking-widest tabular-nums">
                {userInput || "?"}
              </div>
            </div>

            {settings.answerMode === "keypad" && (
              <>
                <div className="grid grid-cols-3 gap-2 md:gap-3 landscape:gap-2 mb-3 md:mb-4 landscape:mb-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleKeypad(num.toString())}
                      className="aspect-square rounded-xl landscape:rounded-lg bg-white border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 text-xl md:text-3xl lg:text-4xl landscape:text-2xl font-bold text-gray-700 active:scale-95 transition-all shadow-sm"
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 md:gap-3 landscape:gap-2 mb-4 md:mb-5 landscape:mb-2">
                  <button
                    onClick={() => handleKeypad("DELETE")}
                    className="aspect-square rounded-xl landscape:rounded-lg bg-red-100 border-2 border-red-200 hover:border-red-500 hover:bg-red-200 flex items-center justify-center active:scale-95 transition-all shadow-sm"
                  >
                    <Delete className="w-5 h-5 md:w-7 md:h-7 landscape:w-6 landscape:h-6 text-red-700" />
                  </button>
                  <button
                    onClick={() => handleKeypad("0")}
                    className="aspect-square rounded-xl landscape:rounded-lg bg-white border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 text-xl md:text-3xl lg:text-4xl landscape:text-2xl font-bold text-gray-700 active:scale-95 transition-all shadow-sm"
                  >
                    0
                  </button>
                  <button
                    onClick={() => handleKeypad("CLEAR")}
                    className="aspect-square rounded-xl landscape:rounded-lg bg-gray-100 border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-200 flex items-center justify-center active:scale-95 transition-all shadow-sm"
                  >
                    <RotateCw className="w-4 h-4 md:w-6 md:h-6 landscape:w-5 landscape:h-5 text-gray-600" />
                  </button>
                </div>

                <Button onClick={() => submitAnswer(false)} variant="success" size="md" className="w-full landscape:py-2">
                  <Check className="mr-2 w-5 h-5 md:w-6 md:h-6 landscape:w-5 landscape:h-5" /> 確定
                </Button>
              </>
            )}

            {settings.answerMode === "none" && (
              <Button onClick={() => submitAnswer(true)} variant="primary" size="lg" className="w-full">
                口頭回答完了
              </Button>
            )}
          </div>
        </div>
      )
    }

    if (phase === "FEEDBACK") {
      return (
        <div className="flex-1 flex items-center justify-center">
          {feedbackState === "correct" && (
            <div className="text-center animate-bounce-in">
              <div className="text-7xl md:text-8xl landscape:text-6xl mb-3 md:mb-5 landscape:mb-2">✓</div>
              <div className="text-2xl md:text-3xl lg:text-4xl landscape:text-xl font-bold text-green-600">正解！</div>
            </div>
          )}
          {feedbackState === "incorrect" && (
            <div className="text-center animate-shake">
              <div className="text-7xl md:text-8xl landscape:text-6xl mb-3 md:mb-5 landscape:mb-2">✗</div>
              <div className="text-2xl md:text-3xl lg:text-4xl landscape:text-xl font-bold text-red-600">不正解</div>
              <div className="text-lg md:text-xl lg:text-2xl landscape:text-base text-gray-500 mt-2 md:mt-3 landscape:mt-1 tabular-nums">
                {currentStimulus}
              </div>
            </div>
          )}
          {feedbackState === "verbal" && (
            <div className="text-center animate-fade-in">
              <div className="text-6xl md:text-7xl landscape:text-5xl mb-3 md:mb-5 landscape:mb-2">👍</div>
              <div className="text-xl md:text-2xl lg:text-3xl landscape:text-lg font-bold text-blue-600">次へ</div>
            </div>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {renderTopBar()}
      {renderMainArea()}
      {/* Pause Modal */}
      {isPaused && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white p-6 md:p-8 landscape:p-4 rounded-xl shadow-2xl max-w-xs md:max-w-sm landscape:max-w-xs w-full mx-4 text-center">
            <Pause className="w-12 h-12 md:w-16 md:h-16 landscape:w-10 landscape:h-10 text-blue-500 mx-auto mb-3 md:mb-4 landscape:mb-2" />
            <h3 className="text-xl md:text-2xl landscape:text-lg font-bold mb-4 md:mb-6 landscape:mb-3">休憩中</h3>
            <div className="space-y-2 md:space-y-3 landscape:space-y-1.5">
              <Button onClick={() => setIsPaused(false)} variant="primary" size="md" className="w-full">
                再開する
              </Button>
              <Button onClick={onAbort} variant="danger" size="sm" className="w-full bg-white border-0 hover:bg-red-50">
                訓練を終了する
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Result Screen ---

function ResultScreen({ results, onNextSet, onHome }) {
  const correctCount = results.filter((r) => r.isCorrect).length
  const score = Math.round((correctCount / results.length) * 100)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 md:p-8 bg-gradient-to-br from-blue-50 to-white animate-fade-in">
      <div className="text-center mb-6 md:mb-10">
        <div className="text-5xl md:text-6xl lg:text-7xl mb-3 md:mb-5">
          {score === 100 ? "🎉" : score >= 80 ? "🎊" : score >= 60 ? "👏" : "💪"}
        </div>
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-gray-800 mb-2">訓練完了</h2>
        <p className="text-gray-500 text-sm md:text-base lg:text-lg">お疲れさまでした</p>
      </div>

      <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-10 mb-6 md:mb-10 w-full max-w-md md:max-w-lg">
        <div className="flex items-baseline justify-center mb-5 md:mb-7">
          <span className="text-6xl md:text-7xl lg:text-8xl font-black text-blue-900">{score}</span>
          <span className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-400 ml-2">%</span>
        </div>
        <div className="text-center mb-5 md:mb-7">
          <div className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-700">
            {correctCount}
            <span className="text-xl md:text-2xl lg:text-3xl text-gray-400 font-normal">/{results.length}</span>
          </div>
          <p className="text-gray-500 mt-2 text-xs md:text-sm lg:text-base">正解数</p>
        </div>

        <div className="space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              className={`flex justify-between items-center p-2.5 md:p-3 rounded-lg text-sm md:text-base ${
                r.isCorrect ? "bg-green-50" : "bg-red-50"
              }`}
            >
              <span className="font-mono font-bold text-base md:text-lg">{r.trial}</span>
              <span className="font-mono text-gray-700 text-sm md:text-base">{r.stimulus}</span>
              <span className={`text-xl md:text-2xl ${r.isCorrect ? "" : "opacity-50"}`}>
                {r.isCorrect ? "✓" : "✗"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 md:gap-4 w-full max-w-md md:max-w-lg">
        <Button onClick={onHome} variant="secondary" size="md" className="flex-1">
          ホームへ
        </Button>
        <Button onClick={onNextSet} variant="primary" size="md" className="flex-[2]">
          もう一度
        </Button>
      </div>
    </div>
  )
}
