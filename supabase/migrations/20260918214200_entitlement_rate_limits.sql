-- Light wallet/IP rate limits for the entitlement API.
-- Not a financial ledger. No secrets.

CREATE TABLE entitlement_rate_limits (
  bucket_key text PRIMARY KEY CHECK (char_length(bucket_key) BETWEEN 1 AND 160),
  window_start timestamptz NOT NULL,
  hit_count integer NOT NULL CHECK (hit_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
