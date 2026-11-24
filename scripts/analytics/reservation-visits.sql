-- Reservation page measurement (issue hitzu/brillipoint-ops#27).
--
--   psql "$DATABASE_URL" -f scripts/analytics/reservation-visits.sql
--
-- Read-only: only TEMP views, nothing persists. The front sends raw events
-- (one `reservation_viewed` per entry, tab views/leaves, blocks); every
-- threshold lives here so it can change without a deploy.

-- Parameters ---------------------------------------------------------------
CREATE TEMP VIEW rv_params AS
SELECT
  INTERVAL '10 minutes' AS visit_gap,        -- new visit = entry this long after the visitor's last activity
  20000                 AS terms_seen_ms,     -- Q3: "opened Terms" = at least this much visible time
  0.30                  AS terms_read_ratio,  -- Q4: share of the estimated reading time
  230                   AS words_per_minute;  -- Q4: reading speed

-- Base views ---------------------------------------------------------------
-- One row per page load: who (anonymous visitor) and on which contract.
CREATE TEMP VIEW rv_sessions AS
SELECT DISTINCT ON (session_id)
  session_id,
  contract_id,
  metadata ->> 'visitorId' AS visitor_id
FROM event_analytics
WHERE source = 'reservation'
  AND action = 'reservation_viewed'
  AND session_id IS NOT NULL
  AND metadata ->> 'visitorId' IS NOT NULL
ORDER BY session_id, created_at;

CREATE TEMP VIEW rv_events AS
SELECT
  e.id, e.created_at, e.contract_id, s.visitor_id, e.session_id,
  e.action, e.surface, e.metadata
FROM event_analytics e
JOIN rv_sessions s USING (session_id)
WHERE e.source = 'reservation';

-- Visits: an entry that is not a reload, at least `visit_gap` after the
-- visitor's previous activity (any event) on the same contract.
CREATE TEMP VIEW rv_visits AS
WITH activity AS (
  SELECT *,
    lag(created_at) OVER (PARTITION BY contract_id, visitor_id ORDER BY created_at, id) AS prev_at
  FROM rv_events
), starts AS (
  SELECT a.*,
    row_number() OVER (PARTITION BY contract_id, visitor_id ORDER BY created_at, id) AS visit_no
  FROM activity a, rv_params p
  WHERE a.action = 'reservation_viewed'
    AND a.metadata ->> 'entry' <> 'reload'
    AND (a.prev_at IS NULL OR a.created_at - a.prev_at >= p.visit_gap)
)
SELECT
  contract_id, visitor_id, session_id, visit_no,
  created_at AS started_at,
  -- A visit lasts until the same visitor's next visit starts.
  lead(created_at) OVER (PARTITION BY contract_id, visitor_id ORDER BY created_at, id) AS ended_at,
  metadata ->> 'entry'                           AS entry,
  (metadata ->> 'hasPayments')::boolean          AS has_payments,
  (metadata ->> 'daysToEvent')::int              AS days_to_event
FROM starts;

-- Q1. How many times does the client come back? ------------------------------
-- Returns = visits after the first. visitors > 1 means the link was shared.
SELECT
  contract_id,
  count(DISTINCT visitor_id)                          AS visitors,
  count(*)                                            AS visits,
  count(*) FILTER (WHERE visit_no > 1)                AS returns,
  count(*) FILTER (WHERE NOT has_payments)            AS preview_visits,
  count(*) FILTER (WHERE has_payments)                AS paid_visits
FROM rv_visits
GROUP BY contract_id
ORDER BY contract_id;

-- Tab time: each tab view paired with the next "left" of the same page load.
CREATE TEMP VIEW rv_tab_time AS
SELECT
  v.contract_id, v.visitor_id, v.session_id, v.surface,
  v.metadata ->> 'trigger' AS trigger,
  v.created_at,
  l.metadata AS left_metadata,
  (l.metadata ->> 'visibleMs')::bigint AS visible_ms
FROM rv_events v
LEFT JOIN LATERAL (
  SELECT metadata FROM rv_events l
  WHERE l.session_id = v.session_id
    AND l.action = 'reservation_section_left'
    AND l.surface = v.surface
    AND l.created_at >= v.created_at
  ORDER BY l.created_at LIMIT 1
) l ON true
WHERE v.action = 'reservation_section_viewed';

-- Q2. Where does the client go first? ----------------------------------------
-- Only tabs opened by click (landing is not a choice: every load starts on Resumen).
SELECT
  surface                          AS tab,
  count(*)                         AS opens,
  count(DISTINCT contract_id)      AS contracts,
  round(avg(visible_ms) / 1000.0, 1) AS avg_visible_s
FROM rv_tab_time
WHERE trigger = 'click'
GROUP BY surface
ORDER BY opens DESC;

-- Q3. Does the client read the terms? ------------------------------------------
-- Opened "terms" and had it visible for at least `terms_seen_ms`.
SELECT
  count(DISTINCT contract_id) FILTER (WHERE total_ms >= p.terms_seen_ms) AS contracts_that_saw_terms,
  count(DISTINCT contract_id)                                            AS contracts_that_opened_terms
FROM (
  SELECT contract_id, session_id, sum(visible_ms) AS total_ms
  FROM rv_tab_time
  WHERE surface = 'terms'
  GROUP BY contract_id, session_id
) t, rv_params p
GROUP BY p.terms_seen_ms;

-- Q4. Do they read them to the end? ----------------------------------------------
-- Exposure, not reading: reached the end AND stayed at least
-- `terms_read_ratio` of the estimated reading time (words / words_per_minute).
SELECT
  count(DISTINCT contract_id) FILTER (
    WHERE (left_metadata ->> 'reachedEnd')::boolean
      AND visible_ms >= p.terms_read_ratio
          * ((left_metadata ->> 'wordCount')::numeric / p.words_per_minute) * 60000
  ) AS contracts_that_read_terms_to_the_end,
  count(DISTINCT contract_id) AS contracts_with_a_terms_leave
FROM rv_tab_time, rv_params p
WHERE surface = 'terms' AND left_metadata IS NOT NULL;

-- Q5. Where does the upsell fit? ---------------------------------------------------
-- Return visits only: what brings them back (first tab of the visit), where
-- they spend time, and how close to the event they return.
CREATE TEMP VIEW rv_return_visits AS
SELECT v.*
FROM rv_visits v
WHERE v.visit_no > 1;

-- 5a. First tab of each return visit.
SELECT
  first_tab.surface AS first_tab,
  count(*)          AS return_visits
FROM rv_return_visits r
JOIN LATERAL (
  SELECT surface FROM rv_events e
  WHERE e.session_id = r.session_id
    AND e.action = 'reservation_section_viewed'
    AND e.created_at >= r.started_at
  ORDER BY e.created_at, e.id LIMIT 1
) first_tab ON true
GROUP BY first_tab.surface
ORDER BY return_visits DESC;

-- 5b. Time per tab in return visits.
SELECT
  t.surface AS tab,
  count(*)  AS views,
  round(sum(t.visible_ms) / 1000.0, 1) AS total_visible_s
FROM rv_tab_time t
JOIN rv_return_visits r
  ON r.session_id = t.session_id
 AND t.created_at >= r.started_at
 AND (r.ended_at IS NULL OR t.created_at < r.ended_at)
GROUP BY t.surface
ORDER BY total_visible_s DESC NULLS LAST;

-- 5c. When do they return? Days to the event, in buckets.
SELECT
  CASE
    WHEN days_to_event IS NULL THEN 'unknown'
    WHEN days_to_event < 0     THEN 'after the event'
    WHEN days_to_event <= 7    THEN '0-7 days'
    WHEN days_to_event <= 30   THEN '8-30 days'
    WHEN days_to_event <= 90   THEN '31-90 days'
    ELSE '90+ days'
  END AS days_to_event,
  count(*) AS return_visits
FROM rv_return_visits
GROUP BY 1
ORDER BY min(days_to_event);
