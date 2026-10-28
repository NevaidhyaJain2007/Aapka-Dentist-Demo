w# Aapka Dentist

A responsive dental clinic website and virtual receptionist demo. It is intentionally dependency-free to comply with restrictions against unapproved third-party code, APIs, SDKs, services, and repositories.

## Run locally

Prerequisite: Node.js 18 or newer. Copy .env.example to .env to customize settings (export values in your shell; no dotenv package is used). Run npm start, then open http://localhost:4173. There is no package installation step. Persistent demo records are in data/store.json. Do not use this as a production patient database.

## Demo behavior

- Original deterministic receptionist flow; no LLM or hosted AI API.
- Monday–Saturday, 9 AM–6 PM in the configured time zone; service durations, 30-minute grid, past-time rejection, overlap checks, and revalidation on creation.
- Bookings/cancellations persist. Confirmation and generated references are handled server-side.
- Booking-email and cancellation-email attempts are recorded as simulated; no email is sent.
- Cancellation checks reference plus booking email and asks for confirmation. This is not production identity verification.
- Admin portal is an unauthenticated simulated staff view. Do not expose it publicly.
- Reset clears all records and cannot be undone.

## Configuration

The server accepts PORT, CLINIC_NAME, CLINIC_TIMEZONE, CLINIC_EMAIL, CLINIC_PHONE, and CLINIC_ADDRESS. Demo contact details are placeholders.

## API

GET /api/clinic; GET /api/services; GET /api/availability?date=YYYY-MM-DD&serviceId=S1; POST /api/appointments; POST /api/cancel/lookup; POST /api/cancel; POST /api/chat; GET /api/admin; POST /api/admin/reset.

## Compliance inventory

| Item | Purpose | Compliance status |
| --- | --- | --- |
| Node.js built-in http, fs, crypto, path | Server and persistence | Runtime built-ins; no downloaded implementation |
| Browser HTML, CSS, JavaScript, Fetch, Web Speech API | UI, API calls, optional user-activated speech input | Native browser capabilities |
| System fonts | Typography | Local CSS only |
| Inline SVG illustration | Hero visual | Original locally embedded illustration |
| Hosted AI, email, database APIs | None | Not used |
| npm packages, SDKs, GitHub code | None | Not used |

No external assets, APIs, or packages are used by the application.

## Limitations and production path

This demo uses single-process JSON storage, deterministic chat, simulated email, and simulated admin access. File writes do not provide cross-process transactions. The cancellation check is not enough for real patient data. Before a live launch, obtain organizer approval for dependencies and services, then implement an approved transactional database with atomic slot constraints, real staff authentication and authorization, stronger cancellation verification, rate limiting, security review, clinic-approved content, and an approved email provider.

## Checks

Run node --check server.mjs and node --check public/app.js. HTTP workflows can be exercised locally without credentials.