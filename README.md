# Billmap Bangla Beacon

Build a clean, simple, mobile-friendly ISP bill collection management web app for a small service area. Keep it focused and avoid unnecessary enterprise features. Main screen: interactive Leaflet/OpenStreetMap customer map. Do NOT use browser/device/current-location geolocation; customer latitude/longitude comes from stored customer data. Customer pins: green paid, yellow due/unpaid, red overdue. Simple geographic Zones with basic boundaries/polygons and collector assignment. Filters: All, Zone, Collector, Paid, Unpaid, Overdue. Search by customer name, phone, or address. Clicking a pin opens a compact card showing name, address, monthly bill, due amount, status, collector, last payment, with Collect and Navigate actions. Navigate opens an external map directions link using the customer's coordinates and must not request the user's location. Collect opens a simple payment dialog for amount, method, date, optional receipt number; saving updates due/status and totals. Show a compact summary: total customers, paid, unpaid, overdue, total due, collected today. Zone selection shows zone customers, collector, and simple stats. Optional simple collector route lines, but no route optimization or AI routing. Admin can add/edit customers, collectors, and zones. Use realistic Bangladesh-style demo data and BDT currency. Data model: customers, collectors, zones, payments. Use Supabase/PostgreSQL persistence if appropriate, with sensible relationships and basic RLS. Mobile-first collector-friendly UI and desktop responsive. Professional map-first design with compact cards and clear status badges. Avoid excessive charts, AI, forecasting, complex analytics, route optimization, or unnecessary features. Build a working populated app, not just a mockup.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/67662821-399f-4690-9199-ff9c0ad5e6d1).

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
