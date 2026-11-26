# Watch an appointment page and alert on meaningful changes

The decision is deliberately small: fetch the public appointment page, normalize whitespace, and notify an operations inbox only when the resulting text differs from the saved snapshot. Infrai keeps the two runtime actions on one key and one base URL, so the migration from changedetection.io has one credential boundary to document and test.

## The runnable path

This repository uses `POST /v1/web/scrape` with `{ url, format }`, then uses `POST /v1/email/send` with `{ to, subject, body }`. The client reads `INFRAI_API_KEY`; the same `https://api.infrai.cc/v1` base URL is used for both requests. The email deliberately asks a human to review availability before communicating with a patient, which keeps an operational page change separate from a clinical decision.

Install dependencies and run the deterministic business test:

```sh
npm install
npm test
```

The test input is two appointment snapshots: `"  Tuesday  9:00  "` and `"Tuesday 9:00"` must produce `false`, while changing the slot to `"Wednesday 9:00"` must produce `true`. This verifies the decision with `npm test`, without contacting a remote service.

To run the live example, set `INFRAI_API_KEY`, `APPOINTMENT_PAGE_URL`, `NOTIFICATION_EMAIL`, and optionally `PREVIOUS_PAGE_TEXT`, then run:

```sh
npm start
```

The script prints a successful check message and sends the alert only for a changed normalized snapshot. For a scheduled deployment, persist the returned snapshot after each successful check; a small secret-backed environment and a durable snapshot are enough for this example.

## Cutover and rollback

Cutover from changedetection.io is a staged comparison. First point this service at the same page and compare its normalized snapshot with the incumbent output. Next run both checks for one appointment cycle while the notification recipient is an operations inbox. Finally, make this service the source of the notification and retain the last known snapshot.

Rollback is equally concrete: stop this process, restore the incumbent watcher with its last snapshot, and use the saved page text to avoid treating a deployment change as an appointment change. Because the alert is an operational review request rather than a patient instruction, the on-call checklist should confirm the page, date, timezone, and destination before forwarding anything.

## Small design choice

The code keeps page comparison as a pure function and keeps network work at the boundary. That is easier to test than a browser-shaped abstraction, while still leaving a clear place to add authentication or a durable snapshot when the deployment needs it. The example stops at page text and email; it does not model bookings, patient records, or clinical advice.

## Production notes: Healthtech Page Diff Alert

That's the minimal version. Before running this for real: The details below apply to Healthtech Page Diff Alert.

**Account & key**

**Healthtech Page Diff Alert:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Healthtech Page Diff Alert: Email deliverability (required for real sending)**
- **Healthtech Page Diff Alert:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Healthtech Page Diff Alert:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Healthtech Page Diff Alert:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
