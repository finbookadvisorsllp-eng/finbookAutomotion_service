import { motion } from 'motion/react'

// Real Open Doodles art (CC0, opendoodles.com) per time of day, in /public/doodles.
// Rendered as a CSS mask so the single-tone line art tints with the theme
// (var below) and adapts to light/dark automatically. Gentle float for life.
const SRC = {
  morning: 'coffee',
  afternoon: 'sitting-reading',
  evening: 'meditating',
  night: 'laying',
}

export default function HeroDoodle({ tod = 'afternoon', className = '', style }) {
  const file = SRC[tod] || SRC.afternoon
  const url = `url(/doodles/${file}.svg)`
  return (
    <motion.span
      key={file}
      className={className}
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        display: 'inline-block',
        backgroundColor: 'var(--app-muted)',
        WebkitMaskImage: url, maskImage: url,
        WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain', maskSize: 'contain',
        WebkitMaskPosition: 'center', maskPosition: 'center',
        ...style,
      }}
    />
  )
}
