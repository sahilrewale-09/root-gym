import { Activity, Dumbbell, HeartPulse } from 'lucide-react'

const ZONES = [
  {
    icon: Dumbbell,
    title: 'Strength Zone',
    items: ['Bench press', 'Cable machines', 'Dumbbells & Barbells', 'Squat rack'],
  },
  {
    icon: HeartPulse,
    title: 'Cardio Zone',
    items: ['PowerMax treadmills', 'Elliptical trainers', 'Spin bikes', 'Rowing machines'],
  },
  {
    icon: Activity,
    title: 'Functional Zone',
    items: ['Resistance bands', 'Kettlebells', 'Pull-up stations', 'Core training area'],
  },
]

export function Equipment() {
  return (
    <section id="equipment" className="py-24 sm:py-32 bg-card/30">
      <div className="mx-auto max-w-6xl px-4">

        <div className="flex items-center gap-4 mb-6">
          <div className="h-px flex-1 bg-border max-w-[60px]" />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Equipment</span>
        </div>

        <h2 className="font-heading text-5xl leading-none tracking-tight sm:text-7xl text-balance mb-16">
          WORLD-CLASS<br />
          <span className="text-gold">EQUIPMENT.</span>
        </h2>

        <div className="grid gap-4 md:grid-cols-3">
          {ZONES.map((zone) => (
            <div
              key={zone.title}
              className="rounded-xl bg-background border border-border p-8 hover:border-gold/50 transition-colors group"
            >
              <div className="flex size-12 items-center justify-center rounded-lg border border-border bg-card text-gold group-hover:bg-gold/10 group-hover:border-gold transition-colors">
                <zone.icon className="size-6" />
              </div>
              <h3 className="mt-6 font-heading text-2xl tracking-wide">{zone.title}</h3>
              <ul className="mt-5 space-y-2.5">
                {zone.items.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-white/50 text-sm">
                    <span className="size-1.5 rounded-full bg-gold shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-white/30">
          All cardio equipment from{' '}
          <span className="text-gold font-bold">PowerMax</span> — India's leading fitness brand.
        </p>
      </div>
    </section>
  )
}
