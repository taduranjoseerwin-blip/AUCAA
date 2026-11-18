-- Migration: add bracket columns to games table (idempotent)
-- Run once: mysql -u root -p < migrate_add_bracket_columns.sql

USE aucaa_db;

SET @add_bracket_round := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE games ADD COLUMN bracket_round INT NULL',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = 'aucaa_db' AND table_name = 'games' AND column_name = 'bracket_round'
);
PREPARE s1 FROM @add_bracket_round; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @add_bracket_slot := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE games ADD COLUMN bracket_slot INT NULL',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = 'aucaa_db' AND table_name = 'games' AND column_name = 'bracket_slot'
);
PREPARE s2 FROM @add_bracket_slot; EXECUTE s2; DEALLOCATE PREPARE s2;

SET @add_next_game_id := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE games ADD COLUMN next_game_id INT NULL',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = 'aucaa_db' AND table_name = 'games' AND column_name = 'next_game_id'
);
PREPARE s3 FROM @add_next_game_id; EXECUTE s3; DEALLOCATE PREPARE s3;

SET @add_winner_team_id := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE games ADD COLUMN winner_team_id INT NULL',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = 'aucaa_db' AND table_name = 'games' AND column_name = 'winner_team_id'
);
PREPARE s4 FROM @add_winner_team_id; EXECUTE s4; DEALLOCATE PREPARE s4;

-- Indexes
SET @add_idx_bracket_round := (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_bracket_round ON games (bracket_round)',
    'SELECT 1')
  FROM information_schema.statistics
  WHERE table_schema = 'aucaa_db' AND table_name = 'games' AND index_name = 'idx_bracket_round'
);
PREPARE s5 FROM @add_idx_bracket_round; EXECUTE s5; DEALLOCATE PREPARE s5;

SET @add_idx_bracket_slot := (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_bracket_slot ON games (bracket_slot)',
    'SELECT 1')
  FROM information_schema.statistics
  WHERE table_schema = 'aucaa_db' AND table_name = 'games' AND index_name = 'idx_bracket_slot'
);
PREPARE s6 FROM @add_idx_bracket_slot; EXECUTE s6; DEALLOCATE PREPARE s6;

-- Foreign key for winner_team_id -> teams(team_id)
SET @add_fk_winner := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE games ADD CONSTRAINT fk_games_winner_team FOREIGN KEY (winner_team_id) REFERENCES teams(team_id)',
    'SELECT 1')
  FROM information_schema.table_constraints
  WHERE table_schema = 'aucaa_db' AND table_name = 'games' AND constraint_name = 'fk_games_winner_team'
);
PREPARE s7 FROM @add_fk_winner; EXECUTE s7; DEALLOCATE PREPARE s7;

-- Foreign key for next_game_id -> games(game_id) (self-reference)
SET @add_fk_next_game := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE games ADD CONSTRAINT fk_games_next_game FOREIGN KEY (next_game_id) REFERENCES games(game_id)',
    'SELECT 1')
  FROM information_schema.table_constraints
  WHERE table_schema = 'aucaa_db' AND table_name = 'games' AND constraint_name = 'fk_games_next_game'
);
PREPARE s8 FROM @add_fk_next_game; EXECUTE s8; DEALLOCATE PREPARE s8;

-- Optional: ensure bracket_stage enum exists (already present in setup.sql, but this is safe)
SET @add_bracket_stage := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE games ADD COLUMN bracket_stage ENUM(\'quarterfinal\', \'semifinal\', \'final\', \'third_place\') DEFAULT NULL',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = 'aucaa_db' AND table_name = 'games' AND column_name = 'bracket_stage'
);
PREPARE s9 FROM @add_bracket_stage; EXECUTE s9; DEALLOCATE PREPARE s9;

SELECT 'Migration complete: bracket columns added (if they did not exist)';
