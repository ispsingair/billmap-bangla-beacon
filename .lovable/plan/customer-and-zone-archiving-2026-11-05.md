# Customer and zone archiving

## Result
- Replace customer and zone Delete actions with admin-only Archive confirmation; collector deletion stays unchanged.
- Add an Archived admin tab showing customer/zone names, archived dates, purge dates exactly 60 days later, and Restore.
- Hide archived rows from all active lists, selectors, maps, zone overlays and collector access. Preserve retained history and polygons.
- Stop recurring bills for archived customers.
- Run an authorized, FK-safe database purge daily for records whose 60-day retention has elapsed, without executing a purge or changing existing records now.

## Technical details
- Add nullable `archived_at` fields through an additive migration, secure archive/restore database functions, active collector policies, and safe permanent-deletion protections.
- Keep archived records in a separate admin-only query result; all current workflows continue using active data.
- Archiving a zone does not archive its customers or remove their saved association. Collectors lose access through that zone; on permanent zone purge, surviving customers become unassigned.
- Scheduled work runs entirely in PostgreSQL, independent of publication. Daily processing means deletion may occur up to 24 hours after eligibility; report any scheduler limitation.
- Add retention, filtering and authorization regression tests; run the full suite and inspect automatic build/typecheck results. Do not publish.

## Safety
No customer, zone, bill, payment or allocation rows will be archived, restored or deleted during this implementation. Verify mutations using rollback-only database checks where available.