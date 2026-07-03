-- Run if upgrading from an earlier schema
USE esoftwarestore;

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS user_id INT NULL AFTER id;

CREATE TABLE IF NOT EXISTS vendor_payouts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT NOT NULL,
  amount INT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  reference VARCHAR(120),
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
