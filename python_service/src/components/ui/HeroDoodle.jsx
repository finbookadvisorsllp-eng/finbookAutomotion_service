import OpenDoodle from './OpenDoodle'

// Time-of-day Open Doodle for the dashboard hero.
const SRC = { morning: 'coffee', afternoon: 'sitting-reading', evening: 'meditating', night: 'laying' }

export default function HeroDoodle({ tod = 'afternoon', className = '', style }) {
  return <OpenDoodle name={SRC[tod] || SRC.afternoon} className={className} tint="var(--app-muted)" float style={style} />
}
