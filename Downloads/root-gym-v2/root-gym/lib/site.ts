export const PHONE_DISPLAY = '91525 15502'
export const PHONE_TEL = '9152515502'
export const WHATSAPP_NUMBER = '919152515502'

export const ADDRESS =
  '38/310, Kothari Bhavan, Unnat Nagar 4, Goregaon West, Mumbai - 400104'

export const MAPS_URL =
  'https://www.google.com/maps/search/?api=1&query=Root+Gym+Goregaon+West+Mumbai'

export function waLink(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

export const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'About', href: '#about' },
  { label: 'Gallery', href: '#gallery' },
  { label: 'Equipment', href: '#equipment' },
  { label: 'Reviews', href: '#reviews' },
  { label: 'Contact', href: '#contact' },
]