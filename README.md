# AX Request Portal

> 🚧 Work in progress. Screens are being built in stages; this README will be expanded with setup, configuration, API contract and deployment guides.

A responsive React template for an **AI-assisted work request portal**: non-developers (planning, sales, management) file structured requests, an AI writes a feasibility report, a developer approves, the AI does the work up to a merge request, and humans verify and release.

**Core principle: AI executes, people decide.**

## Request lifecycle

`Submitted → Report (AI) → Developer review → In progress (AI) → Verification → Release scheduled → Done`

Exceptions: _More info needed_ (review), _Rejected_ (review), _Changes requested_ (verification).

## Roles

| Role      | Main screens                                                                                    |
| --------- | ----------------------------------------------------------------------------------------------- |
| Requester | Request wizard · My requests · Result check against acceptance criteria · Release schedule      |
| Executive | Requester screens + company-wide dashboard                                                      |
| Developer | Assigned requests · Feasibility report · Run work · Work detail (MR, tests) · Regression checks |
| Admin     | Projects (repository, wiki, owners) · Users and roles · AI cost limits                          |

Every screen is designed to be fully usable on **phones, tablets and desktops**.

## Stack

React 19 · Vite · TypeScript · React Router · TanStack Query · Zustand · Tailwind CSS v4 · shadcn/ui · React Hook Form + Zod · MSW (mock API) · Vitest · Playwright

## Quick start

```bash
npm install
npm run dev
```

| Script             | Purpose                                                        |
| ------------------ | -------------------------------------------------------------- |
| `npm run dev`      | Dev server                                                     |
| `npm run build`    | Production build into `dist/` (static files, serve with nginx) |
| `npm run verify`   | Lint + format check + typecheck + unit tests + build           |
| `npm run test:e2e` | Playwright on phone, tablet and desktop viewports              |

## License

[MIT](LICENSE)
