import { Camera, MapPin } from 'lucide-react'
import { MAPS_URL } from '@/lib/site'

const QUICK_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'Equipment', href: '#equipment' },
  { label: 'Membership', href: '#membership' },
  { label: 'Contact', href: '#contact' },
]

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-heading text-2xl tracking-wide text-gold">
              ROOT<span className="text-foreground"> GYM</span>
            </p>
            <p className="mt-2 text-muted-foreground">Your Health, Our Mission</p>
          </div>

          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {QUICK_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-gold"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex gap-3">
            <a
              href="#"
              aria-label="Instagram"
              className="flex size-10 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-gold hover:text-gold"
            >
              <Camera className="size-5" />
            </a>
            <a
              href={MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Google Maps"
              className="flex size-10 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-gold hover:text-gold"
            >
              <MapPin className="size-5" />
            </a>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          <p>© 2025 Root Gym. All rights reserved.</p>
          <p className="mt-1 text-xs">Website by Sahil · Web Developer</p>
        </div>
      </div>
    </footer>
  )
}
