-- idempotent migration compatible with older MySQL: create brackets table and add bracket_id to games if missing
CREATE TABLE IF NOT EXISTS brackets (
  bracket_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  league_id INT NOT NULL,
  size INT NOT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  INDEX (league_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DELIMITER $$
DROP PROCEDURE IF EXISTS add_bracket_id_if_missing$$
CREATE PROCEDURE add_bracket_id_if_missing()
BEGIN
  IF (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='games' AND COLUMN_NAME='bracket_id')=0 THEN
    ALTER TABLE games ADD COLUMN bracket_id BIGINT NULL;
  END IF;
END$$
DELIMITER ;

CALL add_bracket_id_if_missing();
DROP PROCEDURE IF EXISTS add_bracket_id_if_missing;
