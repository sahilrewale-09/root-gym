import { Dumbbell, Sparkles, Users, UserCheck } from 'lucide-react'

const FEATURES = [
  {
    icon: Dumbbell,
    title: 'Premium Equipment',
    desc: 'PowerMax treadmills, ellipticals, cable machines, free weights and more. Everything you need, always maintained.',
  },
  {
    icon: UserCheck,
    title: 'Expert Trainers',
    desc: 'Certified, experienced, and genuinely supportive. Our staff knows your name, not just your membership number.',
  },
  {
    icon: Sparkles,
    title: 'Clean & Hygienic',
    desc: 'Cleanliness is our first priority. Equipment maintained daily so you can focus entirely on your workout.',
  },
  {
    icon: Users,
    title: 'Real Community',
    desc: 'A gym where members grow together. Positive energy, zero ego, and 100% serious about fitness.',
  },
]

export function Features() {
  return (
    <section id="about" className="mx-auto max-w-6xl px-4 py-24 sm:py-32">
      {/* Section label */}
      <div className="flex items-center gap-4 mb-6">
        <div className="h-px flex-1 bg-border max-w-[60px]" />
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Why Root Gym</span>
      </div>

      <h2 className="font-heading text-5xl leading-none tracking-tight sm:text-7xl text-balance mb-16">
        BUILT FOR PEOPLE<br />
        <span className="text-gold">SERIOUS ABOUT FITNESS.</span>
      </h2>

      <div className="grid gap-px bg-border sm:grid-cols-2">
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            className="group bg-background p-8 transition-colors hover:bg-card"
          >
            <div className="flex size-11 items-center justify-center rounded-lg border border-border bg-card text-gold group-hover:border-gold group-hover:bg-gold/10 transition-colors">
              <f.icon className="size-5" />
            </div>
            <h3 className="mt-6 font-heading text-2xl tracking-wide">{f.title}</h3>
            <p className="mt-3 leading-relaxed text-white/50">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
