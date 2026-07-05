import { Clock, MapPin, MessageCircle, Navigation, Phone } from 'lucide-react'
import {
  ADDRESS,
  PHONE_DISPLAY,
  PHONE_TEL,
  WHATSAPP_NUMBER,
  waLink,
} from '@/lib/site'

export function Contact() {
  const details = [
    {
      icon: MapPin,
      label: 'Address',
      value: ADDRESS,
    },
    {
      icon: Phone,
      label: 'Phone',
      value: PHONE_DISPLAY,
      href: `tel:${PHONE_TEL}`,
    },
    {
      icon: MessageCircle,
      label: 'WhatsApp',
      value: WHATSAPP_NUMBER,
      href: waLink("Hi, I'm interested in joining Root Gym Goregaon. Can you share membership details?"),
    },
    {
      icon: Clock,
      label: 'Hours',
      value: 'Monday–Sunday, 6:00 AM – 11:00 PM',
    },
    {
      icon: Navigation,
      label: 'Near',
      value: 'Ambe Mata Mandir, Goregaon West',
    },
  ]

  return (
    <section id="contact" className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-heading text-4xl tracking-wide text-balance sm:text-5xl">
          Visit Us <span className="text-gold">Today</span>
        </h2>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          {details.map((d) => {
            const content = (
              <>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
                  <d.icon className="size-5" />
                </span>
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {d.label}
                  </span>
                  <span className="mt-0.5 block leading-relaxed">{d.value}</span>
                </span>
              </>
            )

            return d.href ? (
              <a
                key={d.label}
                href={d.href}
                target={d.href.startsWith('http') ? '_blank' : undefined}
                rel={d.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-gold"
              >
                {content}
              </a>
            ) : (
              <div
                key={d.label}
                className="flex items-start gap-4 rounded-xl border border-border bg-card p-4"
              >
                {content}
              </div>
            )
          })}
        </div>

        <div className="overflow-hidden rounded-xl border border-border">
          <iframe
            title="Root Gym location on Google Maps"
            src="https://www.google.com/maps?q=Root+Gym+Goregaon+West+Mumbai&output=embed"
            width="100%"
            height="100%"
            style={{ border: 0, minHeight: 380 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  )
}
