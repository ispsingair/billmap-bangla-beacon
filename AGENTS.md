<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Bill status and customer totals are derived from monthly bills and non-voided allocations; legacy customer dues are deprecated. Why: multiple outstanding months must remain consistent.
- Collections use the transactional collect_months RPC with idempotency keys and customer locking; payments are immutable and reversals are audited. Why: prevents overpayment and partial multi-month writes.
- Recurrence uses an idempotent monthly database job plus staff sync catch-up, with customer recurring defaults. Why: no manual recreation and offline months are recovered.
- A customer's collector is derived from their zone's `collector_id`. Why: one assignment point per zone.
- All data is staff-only with user_roles enforced by RLS: admins manage, collectors read assigned zones/customers and collect via RPC. Existing pre-upgrade staff retain admin; later signups have no access until assigned. Why: preserve legacy access without public privilege escalation.
- The Leaflet map is lazy-loaded (`React.lazy`) so Leaflet never enters SSR.
- Polygon editing uses lazy-loaded Leaflet Draw and Turf validation; automatic customer assignment only occurs for exactly one containing zone, with explicit selection for ambiguity. Why: avoid silently assigning overlapping zones.
