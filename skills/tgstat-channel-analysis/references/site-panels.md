# Verified website analytics

Verified through Chrome DevTools against rendered TGStat panels on 2026-10-13. Channels are runtime parameters; no real channel handles are bundled.

Load `scripts/site-panels.js` and `scripts/collect.js` inside the TGStat page, then run `tgstatCollect({channels,mode:'full',startDate,endDate,maxTablePages:2})`. Alternatively `tgstatCollectPanels` collects only the new website panels. Both return numeric series, read-only panel text, structured table rows, access states and pagination coverage.

All data requests below are website requests, not `api.tgstat.ru`. They are POST with the page's `_tgstat_csrk` and XHR headers. The collector never exports the token or raw headers.

| Website path after `/channel/@USERNAME/stat/` | Parameters | Contents |
| --- | --- | --- |
| `er-chart` | interval, group, startTs, endTs | ER interaction rate |
| `err-chart` | same | ERR view rate |
| `engagements-chart` | interval, startTs/endTs, type: forwards/comments/reactions | Mean interactions per post |
| `citation-index-chart` | interval/year, group/day | Citation-index history |
| `quotes-chart` | interval, group, startTs/endTs | Daily mentions and reposts |
| `posts-count-chart` | same | Daily posts and reposts published |
| `posts-views-adv-chart` | interval and period 12h/24h/48h/72h | Advertising reach |
| `posts-views-analyze/list` | date, page, offset | Post views split over the first 24 hours, with postCharts |
| `posts-popular-table` | date, view, sort | Top posts / stories as supported by the panel |
| `ads-efficiency/list` | channelName, page, offset | Advertisement view/subscriber-growth rows |
| `members-attraction-list` | page, offset | Month-by-month traffic attraction table |

Citation list: POST `/quotes/@USERNAME/list-params`, parameters `source[]=channel`, `type[]=channel`, `type[]=post`, `q`, `p_count`, `page`, `offset`. Capture the filter choices actually requested; do not assume channel-only citations include chats.

Static website sections read without mutation: summary, citation breakdowns, publication calendar, audience and invitation-link access notices. Owner-only sections are not unlocked by the plugin; no invitations are created, edited or reset. An `ok` static block means readable page text, not complete structured demographic data.

## Access and coverage behavior

- A live full-mode run returned 15 series groups, hourly-post rows, citation rows and subscriber history without collector errors.
- The current test account received `restricted` for top posts, advertisement efficiency and attraction, with the site's Premium notice. Those request adapters are included, but successful Premium payload parsing has not been proven under this account; preserve fallback text when a new payload shape appears.
- Audience and invitation links showed owner-confirmation notices. Capture that boundary; never claim the private data was collected.
- Table pagination uses the site's `nextPage`/`nextOffset`; offset can be a post ID rather than an item count. Never increment it yourself.
- Bare `<tr>` fragments must be wrapped in a table before DOM parsing; otherwise cells disappear. Citation rows are list items with `js-post-action`.
- `maxTablePages` is an explicit sample budget. Returned `complete=false`/`hasMore=true` is unfinished coverage; retain checkpoint and increase the budget only within the shared runtime allowance.
- The API may return numeric series values as strings. Normalize valid numbers while retaining nulls and source dates.

## Definitions from the website

ER is interactions (shares/comments/reactions) divided by post views, as the current panel explains. ERR is the percentage of subscribers reading a post. Shares include forwarding into personal messages; public reposts are separate.

Count series (daily publications, mentions, reposts, views) can be summed across a period. Ratios, mean interactions, citation index and reach are snapshots: keep the latest value and, if useful, a clearly labeled mean of daily snapshots. Do not sum their values or describe that mean as a post-weighted average.

Advertisement subscriber growth can overlap campaigns in other channels. The website itself warns that growth during an ad's life is not proof that this placement caused all the growth. Preserve this qualification.
