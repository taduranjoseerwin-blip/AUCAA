-- AUCAA MySQL setup for the backend and frontend app
-- Run this as root or a MySQL admin user:
-- mysql -u root -p --port=3306 < create_mysql_db.sql

CREATE DATABASE IF NOT EXISTS aucaa_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'aucaa_user'@'localhost'
IDENTIFIED BY 'StrongPass123!';

GRANT ALL PRIVILEGES ON aucaa_db.* TO 'aucaa_user'@'localhost';
FLUSH PRIVILEGES;

USE aucaa_db;

-- Create required tables and schema
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

CREATE TABLE IF NOT EXISTS reg_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  role ENUM('admin', 'league_manager', 'player', 'coach', 'fan') DEFAULT 'fan',
  parent_user_id INT NULL,
  used TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS leagues (
  league_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  season VARCHAR(50),
  status ENUM('active', 'completed', 'upcoming') DEFAULT 'active',
  format ENUM('elimination', 'round_robin') DEFAULT 'elimination',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS announcements (
  announcement_id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('general','schedule','live','important') DEFAULT 'general',
  author_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS bracket_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  league_id INT NOT NULL,
  bracket_name VARCHAR(100),
  round_name VARCHAR(50),
  winner_team_id INT,
  loser_team_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (league_id) REFERENCES leagues(league_id)
);

CREATE TABLE IF NOT EXISTS player_stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  game_id INT NOT NULL,
  player_id INT NOT NULL,
  points INT DEFAULT 0,
  rebounds INT DEFAULT 0,
  assists INT DEFAULT 0,
  steals INT DEFAULT 0,
  blocks INT DEFAULT 0,
  turnovers INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES games(game_id),
  FOREIGN KEY (player_id) REFERENCES players(player_id)
);

CREATE TABLE IF NOT EXISTS game_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  game_id INT NOT NULL,
  team_id INT NOT NULL,
  player_id INT,
  action_type VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES games(game_id),
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (player_id) REFERENCES players(player_id)
);

CREATE TABLE IF NOT EXISTS admin_activity (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

SHOW TABLES;
SELECT 'Database and tables created successfully.' AS status;
