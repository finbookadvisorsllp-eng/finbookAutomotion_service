import { motion } from 'motion/react'

// Real Open Doodles art (CC0, opendoodles.com) from /public/doodles, rendered
// as a CSS mask so the single-tone line art tints with the theme and adapts to
// light/dark. One component for every doodle slot in the app.
//   name  — file in /public/doodles (without .svg)
//   tint  — any CSS color (default muted); float — gentle bob
export default function OpenDoodle({ name = 'unboxing', className = '', tint = 'var(--app-accent)', float = false, style }) {
  const url = `url(/doodles/${name}.svg)`
  const Comp = float ? motion.span : 'span'
  const anim = float ? { animate: { y: [0, -6, 0] }, transition: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' } } : {}
  return (
    <Comp
      key={name}
      {...anim}
      className={className}
      style={{
        display: 'inline-block',
        backgroundColor: tint,
        WebkitMaskImage: url, maskImage: url,
        WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain', maskSize: 'contain',
        WebkitMaskPosition: 'center', maskPosition: 'center',
        ...style,
      }}
      aria-hidden="true"
    />
  )
}
