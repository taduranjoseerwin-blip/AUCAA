USE aucaa_db;

ALTER TABLE users
  ADD COLUMN email_verified_at TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN email_verification_token_hash VARCHAR(128) NULL,
  ADD COLUMN email_verification_expires_at DATETIME NULL;

-- Existing accounts are grandfathered as verified. New registrations explicitly use NULL.
UPDATE users
SET email_verified_at = COALESCE(email_verified_at, created_at)
WHERE email_verified_at IS NULL
  AND email_verification_token_hash IS NULL;
