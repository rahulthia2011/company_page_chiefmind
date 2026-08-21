-- Intake submissions from the ContactPage form.
CREATE TABLE IF NOT EXISTS intake_submissions (
  id                TEXT PRIMARY KEY,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  title             TEXT NOT NULL,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  email             TEXT NOT NULL,
  industry          TEXT NOT NULL,
  data_description  TEXT NOT NULL,
  business_outcome  TEXT NOT NULL,
  user_agent        TEXT,
  country           TEXT,
  ip_hash           TEXT
);

CREATE INDEX IF NOT EXISTS idx_intake_created_at ON intake_submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_intake_email      ON intake_submissions(email);
