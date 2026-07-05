import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { waLink } from '@/lib/site'

const PERKS = [
  'Unlimited gym access',
  'Locker facility',
  'Trainer guidance',
  'Free trial session',
]

const PLANS = [
  { name: 'Monthly', price: '₹999', per: '/mo', duration: '1 Month', popular: false },
  { name: 'Quarterly', price: '₹2,499', per: '', duration: '3 Months', popular: true },
  { name: 'Half Yearly', price: '₹4,299', per: '', duration: '6 Months', popular: false },
]

export function Membership() {
  return (
    <section id="membership" className="py-24 sm:py-32 bg-card/30">
      <div className="mx-auto max-w-6xl px-4">

        <div className="flex items-center gap-4 mb-6">
          <div className="h-px flex-1 bg-border max-w-[60px]" />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Membership</span>
        </div>

        <h2 className="font-heading text-5xl leading-none tracking-tight sm:text-7xl text-balance mb-4">
          SIMPLE,<br />
          <span className="text-gold">TRANSPARENT PRICING.</span>
        </h2>
        <p className="text-white/50 mb-16 text-lg">No hidden charges. No lock-ins. Just results.</p>

        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                'relative rounded-xl border p-8 transition-all',
                plan.popular
                  ? 'border-gold bg-gold/5 shadow-[0_0_60px_-15px_rgba(255,224,51,0.3)] md:-translate-y-4'
                  : 'border-border bg-card hover:border-white/30',
              )}
            >
              {plan.popular && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gold px-5 py-1 text-xs font-black uppercase tracking-widest text-background">
                  Most Popular
                </span>
              )}

              <p className="text-xs font-bold uppercase tracking-widest text-white/40">{plan.duration}</p>
              <h3 className="mt-2 font-heading text-2xl tracking-wide">{plan.name}</h3>

              <div className="mt-5 flex items-end gap-1">
                <span className="font-heading text-5xl text-gold leading-none">{plan.price}</span>
                {plan.per && <span className="pb-1 text-white/40 text-sm">{plan.per}</span>}
              </div>

              <div className="my-7 h-px bg-border" />

              <ul className="space-y-3">
                {PERKS.map((perk) => (
                  <li key={perk} className="flex items-center gap-3 text-sm text-white/60">
                    <Check className="size-4 shrink-0 text-gold" />
                    {perk}
                  </li>
                ))}
              </ul>

              <a
                href={waLink(`Hi, I'm interested in the ${plan.name} membership at Root Gym. Can you share more details?`)}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'mt-8 flex w-full items-center justify-center rounded-lg px-4 py-3.5 text-sm font-black uppercase tracking-wide transition-all',
                  plan.popular
                    ? 'bg-gold text-background hover:bg-gold-bright'
                    : 'border-2 border-white/20 text-white hover:border-gold hover:text-gold',
                )}
              >
                Enquire Now
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
