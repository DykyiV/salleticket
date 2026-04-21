# Asol BUS

Bus ticket marketplace (Grandes Tour style) built with **Next.js (App Router)**, **TypeScript** and **Tailwind CSS**.

This is the frontend-only scaffold — no backend yet.

## Stack

- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS 3

## Project structure

```
app/
  layout.tsx        Root layout
  page.tsx          Homepage (hero + search block + features)
  globals.css       Tailwind entry
components/
  Header.tsx        Sticky header with "Asol BUS" logo
  SearchForm.tsx    From / To / Date + Search button
```

## Getting started

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — lint the project

## Notes

The old `pages/` directory is removed — the project fully uses the App Router
(`app/` directory). UI is responsive and mobile-first.
