-- Prefecture Master
CREATE TABLE prefectures (
    id INTEGER PRIMARY KEY,
    name_ja TEXT NOT NULL,
    name_en TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL
);

-- Touring Index Daily
CREATE TABLE touring_index_daily (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prefecture_id INTEGER NOT NULL,
    date DATE NOT NULL,
    score INTEGER NOT NULL,
    weather_factors_json TEXT NOT NULL,
    weather_raw_json TEXT NOT NULL,
    calculated_at DATETIME NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (prefecture_id) REFERENCES prefectures(id),
    UNIQUE(prefecture_id, date)
);

-- Scheduled Run Log: one row per cron-driven batch calculation attempt.
-- Powers the /health/ready coverage and freshness signal.
CREATE TABLE scheduled_run_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL UNIQUE,
    started_at TEXT NOT NULL,
    finished_at TEXT NOT NULL,
    status TEXT NOT NULL,
    expected_count INTEGER NOT NULL,
    committed_count INTEGER NOT NULL,
    failure_count INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL,
    error_summary TEXT
);

CREATE INDEX idx_scheduled_run_log_finished_at ON scheduled_run_log (finished_at);
