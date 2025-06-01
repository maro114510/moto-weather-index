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
