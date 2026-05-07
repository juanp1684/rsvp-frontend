import { useState, useEffect, useRef, useCallback } from 'react'

export default function PhotoCarousel({ images, interval = 5000 }) {
  const [current, setCurrent] = useState(0)
  const touchStart = useRef(null)
  const timerRef = useRef(null)
  const containerRef = useRef(null)

  const resetTimer = useCallback(() => {
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setCurrent((i) => (i === images.length - 1 ? 0 : i + 1)), interval)
  }, [images.length, interval])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) resetTimer()
        else clearInterval(timerRef.current)
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => { observer.disconnect(); clearInterval(timerRef.current) }
  }, [resetTimer])

  const prev = () => { setCurrent((i) => (i === 0 ? images.length - 1 : i - 1)); resetTimer() }
  const next = () => { setCurrent((i) => (i === images.length - 1 ? 0 : i + 1)); resetTimer() }
  const goTo = (i) => { setCurrent(i); resetTimer() }

  const onTouchStart = (e) => { touchStart.current = e.touches[0].clientX }
  const onTouchEnd = (e) => {
    if (touchStart.current === null) return
    const diff = touchStart.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 40) diff > 0 ? next() : prev()
    touchStart.current = null
  }

  return (
    <div ref={containerRef} className="w-full flex flex-col gap-3">
      <div
        className="relative w-full aspect-[4/5] rounded-xl overflow-hidden bg-[#C0A18F]/10 select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {images.map((img, i) => (
          <img
            key={img.id}
            src={img.url}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${i === current ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}

        <button
          onClick={prev}
          className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white transition-colors"
          aria-label="Previous photo"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4"><path d="M15 18l-6-6 6-6"/></svg>
        </button>

        <button
          onClick={next}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white transition-colors"
          aria-label="Next photo"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4"><path d="M9 18l6-6-6-6"/></svg>
        </button>

        <div className="absolute top-2 right-2 bg-black/30 text-white text-xs px-2 py-0.5 rounded-full">
          {current + 1} / {images.length}
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`rounded-full transition-all ${i === current ? 'w-4 h-2 bg-[#A47864]' : 'w-2 h-2 bg-[#C0A18F]/50 hover:bg-[#C0A18F]'}`}
            aria-label={`Go to photo ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
