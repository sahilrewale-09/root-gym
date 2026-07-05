import { MapPin, Phone, Star } from 'lucide-react'
import { MAPS_URL, PHONE_DISPLAY, PHONE_TEL } from '@/lib/site'

export function Hero() {
  return (
    <section
      id="home"
      className="relative flex min-h-screen items-center overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src="/images/hero-gym.png"
          alt=""
          aria-hidden="true"
          className="size-full object-cover opacity-95"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        {/* Yellow glow */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(50% 60% at 20% 60%, rgba(255,224,51,0.10), transparent 70%)',
          }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 pt-28 pb-20">
        {/* Rating pill */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-white/60">
          <Star className="size-3.5 fill-gold text-gold" />
          4.5 / 5 &nbsp;·&nbsp; 100 Google Reviews &nbsp;·&nbsp; Goregaon West
        </div>

        {/* Main heading */}
        <h1 className="mt-7 font-heading leading-none tracking-tight text-balance"
          style={{ fontSize: 'clamp(56px, 10vw, 110px)' }}>
          YOUR HEALTH,{' '}
          <span
            className="text-gold"
            style={{ WebkitTextStroke: '0px', letterSpacing: '-0.01em' }}
          >
            OUR MISSION.
          </span>
        </h1>

        {/* Quote */}
        <p className="mt-8 max-w-xl border-l-[3px] border-gold pl-5 text-base font-medium italic text-white/50 sm:text-lg">
          "Give me a minute, I'm good. Give me an hour, I'm great.
          Give me six months, I'm unbeatable."
        </p>

        {/* Sub */}
        <p className="mt-6 max-w-lg text-lg font-medium text-white/60">
          Mumbai's most serious gym — real equipment, expert trainers, zero ego.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <a
            href={`tel:${PHONE_TEL}`}
            className="inline-flex items-center justify-center gap-2.5 rounded-lg bg-gold px-8 py-4 text-base font-black uppercase tracking-wide text-background transition-all hover:bg-gold-bright hover:scale-[1.02]"
          >
            <Phone className="size-5" />
            Call Now — {PHONE_DISPLAY}
          </a>
          <a
            href={MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2.5 rounded-lg border-2 border-white/20 px-8 py-4 text-base font-black uppercase tracking-wide text-white transition-all hover:border-gold hover:text-gold"
          >
            <MapPin className="size-5" />
            Get Directions
          </a>
        </div>

        {/* Stats row */}
        <div className="mt-16 flex flex-wrap gap-10">
          {[
            { num: '100+', label: 'Active Members' },
            { num: '5+', label: 'Expert Trainers' },
            { num: '6AM–11PM', label: 'Open Daily' },
            { num: '4.5★', label: 'Google Rating' },
          ].map((s) => (
            <div key={s.label}>
              <div className="font-heading text-3xl text-gold">{s.num}</div>
              <div className="mt-0.5 text-xs font-semibold uppercase tracking-widest text-white/40">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
