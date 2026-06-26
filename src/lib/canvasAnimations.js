/**
 * Director Studio — GSAP Canvas Animations
 * Smooth animations for node/edge/panel interactions
 */
import gsap from 'gsap'

// ===== Node Animations =====

/** Animate a new node appearing on the canvas */
export function animateNodeEnter(el) {
  if (!el) return
  gsap.from(el, {
    scale: 0.8, opacity: 0, y: -20,
    duration: 0.4, ease: 'back.out(1.4)',
    clearProps: 'all',
  })
}

/** Animate node deletion */
export function animateNodeExit(el, onComplete) {
  if (!el) { onComplete?.(); return }
  gsap.to(el, {
    scale: 0.6, opacity: 0, y: 20,
    duration: 0.25, ease: 'power2.in',
    onComplete,
  })
}

/** Animate node selection glow */
export function animateNodeSelect(el) {
  if (!el) return
  gsap.to(el, {
    boxShadow: '0 0 0 3px var(--accent, #0EA5E9), 0 0 20px var(--accent-glow)',
    duration: 0.3, ease: 'power2.out',
  })
}

/** Node idle bounce — when generation completes */
export function animateNodePulse(el) {
  if (!el) return
  gsap.to(el, {
    scale: 1.03, duration: 0.15, yoyo: true, repeat: 1,
    ease: 'power2.inOut',
  })
}

// ===== Edge Animations =====

/** New connection line: draw from source to target */
export function animateEdgeDraw(edgePathEl) {
  if (!edgePathEl) return
  const length = edgePathEl.getTotalLength?.()
  if (length) {
    gsap.fromTo(edgePathEl,
      { strokeDasharray: length, strokeDashoffset: length },
      { strokeDashoffset: 0, duration: 0.5, ease: 'power2.inOut' }
    )
  }
}

/** Edge hover glow */
export function animateEdgeGlow(edgeEl, enter = true) {
  if (!edgeEl) return
  gsap.to(edgeEl, {
    filter: enter ? 'drop-shadow(0 0 6px var(--accent-glow))' : 'none',
    duration: 0.2, ease: 'power2.out',
  })
}

// ===== Panel Animations =====

/** Config panel slide in from right */
export function animatePanelEnter(el) {
  if (!el) return
  gsap.from(el, {
    x: 40, opacity: 0, duration: 0.3,
    ease: 'power3.out',
    clearProps: 'all',
  })
}

/** Context menu pop in */
export function animateMenuEnter(el) {
  if (!el) return
  gsap.from(el, {
    scale: 0.9, opacity: 0, y: -8,
    duration: 0.15, ease: 'power2.out',
  })
}

// ===== Generation Progress =====

/** Smooth progress bar fill */
export function animateProgress(el, from, to) {
  if (!el) return
  gsap.fromTo(el, { width: `${from}%` }, { width: `${to}%`, duration: 0.6, ease: 'power2.out' })
}

/** Pulse the generate button during generation */
export function animateGeneratePulse(el) {
  if (!el) return
  gsap.to(el, {
    boxShadow: '0 0 16px var(--accent-glow)',
    duration: 0.8, yoyo: true, repeat: -1,
    ease: 'sine.inOut',
  })
}

/** Stop pulsing */
export function killTweensOf(target) {
  gsap.killTweensOf(target)
}

// ===== Scroll / Viewport =====

/** Smooth scroll to a node */
export function animateScrollTo(x, y, duration = 0.5) {
  return gsap.to(window, {
    scrollTo: { x, y },
    duration,
    ease: 'power2.inOut',
  })
}

// ===== Image Gallery =====

/** Image thumbnail appears */
export function animateThumbnailEnter(el, index = 0) {
  if (!el) return
  gsap.from(el, {
    scale: 0.5, opacity: 0,
    duration: 0.3, delay: index * 0.05,
    ease: 'back.out(1.2)',
    clearProps: 'all',
  })
}

// ===== Utility =====

/** Stagger multiple elements entrance */
export function animateStagger(els, props = {}) {
  if (!els?.length) return
  gsap.from(els, {
    opacity: 0, y: 16, scale: 0.95,
    duration: 0.3, stagger: 0.06,
    ease: 'power2.out',
    ...props,
  })
}
