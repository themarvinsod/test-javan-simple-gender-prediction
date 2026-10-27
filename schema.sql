CREATE TABLE IF NOT EXISTS predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  gender_count INTEGER,
  gender TEXT,
  gender_probability REAL,
  nationality_count INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS nationality_predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prediction_id INTEGER NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  country_id TEXT NOT NULL,
  probability REAL NOT NULL,
  UNIQUE (prediction_id, country_id)
);

CREATE INDEX IF NOT EXISTS idx_predictions_created_at
  ON predictions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nationality_predictions_prediction_id
  ON nationality_predictions(prediction_id);
