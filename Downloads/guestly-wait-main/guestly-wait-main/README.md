# Tablepe Table

You are an expert full-stack developer tasked with building a production-ready, Mobile-First Restaurant Management System called "Tablepe".



### CRITICAL UX REQUIREMENT: MOBILE-FIRST & RESPONSIVE DESIGN

Every page in this application must be engineered mobile-first. Guests will use this on mobile phones (via QR code or mobile browser), host tablets will run the check-in screen, and staff may monitor orders on mobile phones or iPads.

- Mobile Layouts: Max-width containers (`max-w-md` on guest views, full width on mobile viewports), generous touch targets (minimum 44x44px for buttons), auto-focus inputs, sticky bottom cart bars, and collapsible navigation drawers.

- Prevent Horizontal Scrolling: Use `overflow-x-hidden` on wrappers, auto-wrapping flex layouts, and horizontal touch carousels for category tabs.

- Touch Optimization: Active state feedback on buttons (`active:scale-95`), large numeric tap steppers for party sizes, and slide-over panels for cart/filters instead of modals on screens < 768px.



---



### SYSTEM OVERVIEW & ARCHITECTURE

Build a 3-part restaurant management platform:

1. Mobile Guest Check-In & Waitlist Allocation System (Zero-login for guests)

2. Mobile QR Code Menu & Real-time Ordering Engine

3. Responsive Role-Based Admin Dashboard (Staff, Manager, Owner)



---



### STACK & SETUP REQUIREMENTS

- Framework: Next.js (App Router) or TanStack Start

- Backend/DB: Supabase (Postgres, Auth, Realtime)

- Styling: Tailwind CSS + Lucide Icons + Sonner (Toasts)

- QR Generation: `qrcode` or `qrcode.react` package



---



### PHASE 1: GUEST CHECK-IN & AUTOMATIC ALLOCATION (Mobile Screen Scoped)

- Route: `/checkin`

- Mobile UX: Card layout centered in a `max-w-md` container. Large text inputs, prominent numeric stepper buttons (+ / -) for party size (1-12), and a sticky full-width "Check In" button at the bottom of the viewport.

- Logic: On submit, invoke the Supabase RPC `allocate_or_queue_guest(p_name, p_party_size, p_phone)`.

- Session Management: Store the returned `guest_token` in `localStorage` and a cookie named `tablepe_guest_token`.

- Edge Case Notice: If party size > max table capacity, display a full-width amber alert banner: "For parties larger than 8, please speak directly with our host stand."



- Route: `/status`

- Mobile View:

  - Seated State: Prominent table badge ("Table 7"), giant "You're Seated" text, and a primary CTA button "View Menu". Include a secondary "Free Up Table" button at the bottom.

  - Waiting State: Hero position counter ("#3 in line"), estimated wait box ("~15 min"), and an auto-refreshing pulse indicator showing live status synchronization.



---



### PHASE 2: QR MENU & MOBILE GUEST ORDERING

- Route: `/menu` (Query param: `?t=[qr_token]`)

- Mobile UX Layout:

  - Header: Sticky header with restaurant logo, table number badge, and cart button with live badge counter.

  - Category Selector: Horizontally scrollable tab bar (`overflow-x-auto scrollbar-none`) pinned to the top on scroll.

  - Menu Feed: Single-column vertical list on mobile screens (`grid-cols-1 md:grid-cols-2`). Each item displays title, description, price, optional image, and a touch-friendly "+ Add" button.

  - Sticky Floating Cart Bar: Fixed at the bottom (`fixed bottom-4 inset-x-4`). Displays current item count, subtotal, and "View Cart" CTA.

  - Cart Sheet: Bottom-sheet slide-over drawer (using Shadcn Sheet/Drawer) optimized for thumb navigation on mobile phones, with quantity adjusters, item notes input, and a final "Place Order" button.



- Route: `/order/[ticketId]`

- Mobile View: Step tracker (Received → Preparing → Ready → Served) with auto-updating Supabase Realtime listeners.



---



### PHASE 3: RESPONSIVE ADMIN DASHBOARD

- Route Group: `/admin/*`

- Responsive Shell: Collapsible mobile navigation drawer (hamburger menu on mobile viewports `< 768px`), desktop sidebar on screens `>= 768px`.

- Auth Guard Middleware: Checks Supabase auth session + `profiles.role`. Enforces role hierarchy (`staff`, `manager`, `owner`). Redirects unauthorized roles.



#### Admin Pages Breakdown:

1. **Live Operations (`/admin/index`)**:

   - **Mobile Layout**: Tabbed view switching between [Table Map], [Waitlist], and [Kitchen Tickets] so staff can switch views easily on a smartphone.

   - **Table Map Grid**: Responsive grid (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`). Color-coded table cards showing capacity, status, and one-tap status toggles.

   - **Live Waitlist Panel**: Vertical stack with quick "Seat Now" override buttons.

   - **Kitchen Kanban Board**: Horizontal swipeable columns on mobile or responsive grid on desktop (`grid-cols-1 md:grid-cols-4`). Cards show table #, elapsed time, order details, and single-tap status progression buttons.

   - **Sound Alert**: Play a web audio chime when new waitlist entries or tickets arrive via Realtime.



2. **Menu Management (`/admin/menu`)** *(Manager/Owner)*:

   - Mobile-friendly cards or responsive table with horizontal overflow container. Quick-toggle switches for item availability. Touch-friendly modal form for adding/editing items.



3. **Table & QR Management (`/admin/tables`)** *(Manager/Owner)*:

   - Grid of tables with embedded printable QR previews and "Download QR" buttons.



4. **Analytics (`/admin/analytics`)** *(Manager/Owner)*:

   - Stacked mobile metric cards: Revenue Today, Total Orders, Average Wait Time, Turnover Rate.



5. **Staff Management (`/admin/staff`)** *(Owner Only)*:

   - User list with role dropdown selectors.



---



### PHASE 4: REAL-TIME SUBSCRIPTIONS

In the Admin Dashboard layout, initialize a single Supabase channel:

```typescript

const channel = supabase

  .channel('admin-dashboard')

  .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, handleTicketChange)

  .on('postgres_changes', { event: '*', schema: 'public', table: 'waitlist' }, handleWaitlistChange)

  .on('postgres_changes', { event:

 '*', schema: 'public', table: 'restaurant_tables' }, handleTableChange)

  .subscribe();

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://guestly-wait.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/31ae4231-aef2-48ff-8740-0c4a42ffcfdf).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
