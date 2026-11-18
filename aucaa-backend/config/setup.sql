-- ─────────────────────────────────────────────
--  AUCAA Database Setup
--  Run once: mysql -u root -p < setup.sql
-- ─────────────────────────────────────────────

CREATE DATABASE IF NOT EXISTS aucaa_db;
USE aucaa_db;

-- ── USERS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'league_manager', 'player', 'coach', 'fan') DEFAULT 'fan',
  parent_user_id INT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP NULL DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── REGISTRATION CODES ────────────────────────
CREATE TABLE IF NOT EXISTS reg_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  role ENUM('admin', 'league_manager', 'player', 'coach', 'fan') DEFAULT 'fan',
  parent_user_id INT NULL,
  used TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ── LEAGUES ───────────────────────────────────
CREATE TABLE IF NOT EXISTS leagues (
  league_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  season VARCHAR(50),
  status ENUM('active', 'completed', 'upcoming') DEFAULT 'active',
  format ENUM('elimination', 'round_robin') DEFAULT 'elimination',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SET @add_league_format := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE leagues ADD COLUMN format ENUM(\'elimination\', \'round_robin\') DEFAULT \'elimination\'',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = 'aucaa_db' AND table_name = 'leagues' AND column_name = 'format'
);
PREPARE s0 FROM @add_league_format; EXECUTE s0; DEALLOCATE PREPARE s0;

-- ── TEAMS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  team_id INT AUTO_INCREMENT PRIMARY KEY,
  team_name VARCHAR(100) NOT NULL,
  league_id INT,
  coach_id INT,
  division VARCHAR(50) DEFAULT 'Open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (league_id) REFERENCES leagues(league_id),
  FOREIGN KEY (coach_id) REFERENCES users(id)
);

-- ── PLAYERS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS players (
  player_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  team_id INT,
  user_id INT,
  student_id VARCHAR(50),
  date_of_birth DATE,
  height VARCHAR(20),
  weight VARCHAR(20),
  barangay VARCHAR(100),
  verification_status ENUM('pending', 'verified', 'rejected') DEFAULT 'verified',
  verified_at TIMESTAMP NULL DEFAULT NULL,
  jersey_number INT,
  position VARCHAR(30),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Migration for databases created before student_id/verification_status existed.
-- MySQL 8 has no "ADD COLUMN IF NOT EXISTS", so guard via information_schema.
SET @add_student_id := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE players ADD COLUMN student_id VARCHAR(50)',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = 'aucaa_db' AND table_name = 'players' AND column_name = 'student_id'
);
PREPARE s1 FROM @add_student_id; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @add_date_of_birth := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE players ADD COLUMN date_of_birth DATE',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = 'aucaa_db' AND table_name = 'players' AND column_name = 'date_of_birth'
);
PREPARE s1b FROM @add_date_of_birth; EXECUTE s1b; DEALLOCATE PREPARE s1b;

SET @add_height := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE players ADD COLUMN height VARCHAR(20)',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = 'aucaa_db' AND table_name = 'players' AND column_name = 'height'
);
PREPARE s1c FROM @add_height; EXECUTE s1c; DEALLOCATE PREPARE s1c;

SET @add_weight := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE players ADD COLUMN weight VARCHAR(20)',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = 'aucaa_db' AND table_name = 'players' AND column_name = 'weight'
);
PREPARE s1d FROM @add_weight; EXECUTE s1d; DEALLOCATE PREPARE s1d;

SET @add_barangay := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE players ADD COLUMN barangay VARCHAR(100)',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = 'aucaa_db' AND table_name = 'players' AND column_name = 'barangay'
);
PREPARE s1e FROM @add_barangay; EXECUTE s1e; DEALLOCATE PREPARE s1e;

SET @add_region := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE players ADD COLUMN region VARCHAR(100)',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = 'aucaa_db' AND table_name = 'players' AND column_name = 'region'
);
PREPARE s1f FROM @add_region; EXECUTE s1f; DEALLOCATE PREPARE s1f;

SET @add_province := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE players ADD COLUMN province VARCHAR(100)',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = 'aucaa_db' AND table_name = 'players' AND column_name = 'province'
);
PREPARE s1g FROM @add_province; EXECUTE s1g; DEALLOCATE PREPARE s1g;

SET @add_city := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE players ADD COLUMN city VARCHAR(100)',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = 'aucaa_db' AND table_name = 'players' AND column_name = 'city'
);
PREPARE s1h FROM @add_city; EXECUTE s1h; DEALLOCATE PREPARE s1h;

SET @add_ver := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE players ADD COLUMN verification_status ENUM(''pending'', ''verified'', ''rejected'') DEFAULT ''verified''',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = 'aucaa_db' AND table_name = 'players' AND column_name = 'verification_status'
);
PREPARE s2 FROM @add_ver; EXECUTE s2; DEALLOCATE PREPARE s2;

-- Migration for profile_picture column
SET @add_profile_pic := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE players ADD COLUMN profile_picture VARCHAR(255)',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = 'aucaa_db' AND table_name = 'players' AND column_name = 'profile_picture'
);
PREPARE s3 FROM @add_profile_pic; EXECUTE s3; DEALLOCATE PREPARE s3;

SET @add_verified_at := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE players ADD COLUMN verified_at TIMESTAMP NULL DEFAULT NULL',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = 'aucaa_db' AND table_name = 'players' AND column_name = 'verified_at'
);
PREPARE s4 FROM @add_verified_at; EXECUTE s4; DEALLOCATE PREPARE s4;

SET @add_barangay_lat := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE players ADD COLUMN barangay_lat DECIMAL(10,8) NULL',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = 'aucaa_db' AND table_name = 'players' AND column_name = 'barangay_lat'
);
PREPARE s5 FROM @add_barangay_lat; EXECUTE s5; DEALLOCATE PREPARE s5;

SET @add_barangay_lng := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE players ADD COLUMN barangay_lng DECIMAL(11,8) NULL',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = 'aucaa_db' AND table_name = 'players' AND column_name = 'barangay_lng'
);
PREPARE s6 FROM @add_barangay_lng; EXECUTE s6; DEALLOCATE PREPARE s6;

SET @add_barangay_place_id := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE players ADD COLUMN barangay_place_id VARCHAR(255) NULL',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = 'aucaa_db' AND table_name = 'players' AND column_name = 'barangay_place_id'
);
PREPARE s7 FROM @add_barangay_place_id; EXECUTE s7; DEALLOCATE PREPARE s7;

-- ── GAMES ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS games (
  game_id INT AUTO_INCREMENT PRIMARY KEY,
  league_id INT,
  home_team_id INT,
  away_team_id INT,
  home_score INT DEFAULT 0,
  away_score INT DEFAULT 0,
  status ENUM('upcoming', 'live', 'halftime', 'completed', 'forfeited') DEFAULT 'upcoming',
  current_quarter INT DEFAULT 1,
  venue VARCHAR(150),
  live_link VARCHAR(255),
  bracket_stage ENUM('quarterfinal', 'semifinal', 'final', 'third_place') DEFAULT NULL,
  scheduled_time DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (league_id) REFERENCES leagues(league_id),
  FOREIGN KEY (home_team_id) REFERENCES teams(team_id),
  FOREIGN KEY (away_team_id) REFERENCES teams(team_id)
);

SET @add_bracket_stage := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE games ADD COLUMN bracket_stage ENUM(\'quarterfinal\', \'semifinal\', \'final\', \'third_place\') DEFAULT NULL',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = 'aucaa_db' AND table_name = 'games' AND column_name = 'bracket_stage'
);
PREPARE s8 FROM @add_bracket_stage; EXECUTE s8; DEALLOCATE PREPARE s8;

-- ── ANNOUNCEMENTS ────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  announcement_id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('general','schedule','live','important') DEFAULT 'general',
  author_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

SET @add_announcements := (
  SELECT IF(COUNT(*) = 0,
    'CREATE TABLE announcements (announcement_id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(150) NOT NULL, message TEXT NOT NULL, type ENUM(''general'',''schedule'',''live'',''important'') DEFAULT ''general'', author_id INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (author_id) REFERENCES users(id))',
    'SELECT 1')
  FROM information_schema.tables
  WHERE table_schema = 'aucaa_db' AND table_name = 'announcements'
);
PREPARE s9 FROM @add_announcements; EXECUTE s9; DEALLOCATE PREPARE s9;

-- ── PLAYER STATS ──────────────────────────────
CREATE TABLE IF NOT EXISTS player_stats (
  stat_id INT AUTO_INCREMENT PRIMARY KEY,
  game_id INT,
  player_id INT,
  points INT DEFAULT 0,
  rebounds INT DEFAULT 0,
  assists INT DEFAULT 0,
  steals INT DEFAULT 0,
  blocks INT DEFAULT 0,
  turnovers INT DEFAULT 0,
  fouls INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES games(game_id),
  FOREIGN KEY (player_id) REFERENCES players(player_id)
);

-- ── STANDINGS VIEW ────────────────────────────
CREATE OR REPLACE VIEW standings_view AS
SELECT
  t.team_id,
  t.team_name,
  t.league_id,
  COUNT(CASE WHEN (g.home_team_id = t.team_id AND g.home_score > g.away_score)
              OR (g.away_team_id = t.team_id AND g.away_score > g.home_score)
             THEN 1 END) AS wins,
  COUNT(CASE WHEN (g.home_team_id = t.team_id AND g.home_score < g.away_score)
              OR (g.away_team_id = t.team_id AND g.away_score < g.home_score)
             THEN 1 END) AS losses,
  COALESCE(SUM(CASE WHEN g.home_team_id = t.team_id THEN g.home_score
                    WHEN g.away_team_id = t.team_id THEN g.away_score END), 0) AS points_for,
  COALESCE(SUM(CASE WHEN g.home_team_id = t.team_id THEN g.away_score
                    WHEN g.away_team_id = t.team_id THEN g.home_score END), 0) AS points_against,
  COALESCE(SUM(CASE WHEN g.home_team_id = t.team_id THEN g.home_score - g.away_score
                    WHEN g.away_team_id = t.team_id THEN g.away_score - g.home_score END), 0) AS point_diff,
  ROUND(
    COUNT(CASE WHEN (g.home_team_id = t.team_id AND g.home_score > g.away_score)
                OR (g.away_team_id = t.team_id AND g.away_score > g.home_score)
               THEN 1 END) /
    NULLIF(COUNT(CASE WHEN g.status = 'completed' AND (g.home_team_id = t.team_id OR g.away_team_id = t.team_id) THEN 1 END), 0),
  3) AS win_pct
FROM teams t
LEFT JOIN games g ON (g.home_team_id = t.team_id OR g.away_team_id = t.team_id)
  AND g.status = 'completed'
GROUP BY t.team_id, t.team_name, t.league_id;

-- ─────────────────────────────────────────────
--  SEED DATA
-- ─────────────────────────────────────────────

-- Default admin (password: admin123)
INSERT IGNORE INTO users (username, email, password, role, status)
VALUES ('admin', 'admin@aucaa.com', '$2a$10$Bz1PypsmTSN7knDlLgVl7eoSPEhrtBVsE1DxN4GYZZu6wB/1gZa5O', 'admin', 'approved');

-- Registration codes
INSERT IGNORE INTO reg_codes (code, role) VALUES
('AUCAA-SEN-2026', 'player'),
('AUCAA-PLAYER-2026', 'player'),
('AUCAA-MANAGER-2026', 'league_manager'),
('AUCAA-2026', 'fan');
