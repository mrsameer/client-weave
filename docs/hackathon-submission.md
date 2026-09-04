# Hackathon submission guide

## Submission description

ClientWeave is a shared service-scoping workspace where people and browser
agents work from the same attributed state. An agent can discover relevant
services, draft scope changes, calculate deterministic seller-governed pricing,
and find consultation slots. People retain authority over consequential action:
the browser exposes no confirmation tool, and lead submission or booking only
works after a direct human confirmation of the exact current summary.

WebMCP fits because it gives the browser agent structured, explicit procedures
instead of brittle DOM scraping. The registration maps six narrowly scoped
browser tools to the same audited HTTP boundaries used by the human UI.

## Testing instructions for reviewers

1. Open the deployed HTTPS URL in a WebMCP-enabled Chrome or ChatGPT in-app
   browser.
2. Enter a buyer goal, select a service, and create a draft scope.
3. Inspect the browser's discovered WebMCP tools. Call `update_scope`, then
   `price_scope` and `find_consultation_slots`.
4. Ask the agent to call `finalize_confirmed_scope` before any direct page
   confirmation: it must be rejected with no lead, booking, or slot mutation.
5. Directly confirm the displayed action in the page, then retry the tool and
   inspect the owner handoff.

No buyer credentials are needed. Owner routes require the deployer's configured
Supabase account; reviewer credentials must be supplied privately in the
submission form if those routes are part of the demo.

## Three-minute video script

| Time      | What to show and say                                                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:20 | “ClientWeave lets a service buyer and an agent share one attributed scope. The human stays in charge of lead submission and booking.”                                     |
| 0:20–0:55 | Enter a goal, show matching seller services, select one, and create the scope.                                                                                            |
| 0:55–1:35 | Show the browser-discovered WebMCP tools. Ask the agent to update scope details, calculate a price, and read consultation slots. Point out human/agent provenance labels. |
| 1:35–2:15 | Ask the agent to finalize before confirmation. Show the rejection and explain that there is intentionally no agent confirmation tool.                                     |
| 2:15–2:45 | Directly confirm the exact action in the page, then let the agent finalize. Open the owner lead handoff with its immutable quote and activity history.                    |
| 2:45–3:00 | “WebMCP makes collaboration structured and auditable, while ClientWeave keeps consequential authority with the person.”                                                   |

Upload the video publicly to YouTube and paste its URL into the submission form.

## Final external checklist

- [ ] Deploy a public HTTPS URL and test it in an incognito window.
- [ ] Add the URL and this repository URL to the submission form.
- [ ] Set GitHub About description to: `Human-governed service scoping with browser-native WebMCP collaboration.`
- [ ] Set GitHub About website to the deployed HTTPS URL and verify the MIT license appears.
- [ ] Record and publish the sub-three-minute English YouTube video above.
- [ ] As a solo entrant, leave teammates empty; no invitations are required.
- [ ] Ensure the submission form is marked **Submitted**, not **Draft**.
- [ ] If the project predates the submission period, state: “During the submission period, ClientWeave added browser-native WebMCP registration, audited capability adapters, direct-human finalization protection, and the complete shared-scope workflow.”
