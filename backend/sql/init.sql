CREATE DATABASE IF NOT EXISTS esoftwarestore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE esoftwarestore;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'customer',
  country_code VARCHAR(2) DEFAULT 'IN',
  locale VARCHAR(10) DEFAULT 'en',
  wallet_balance INT NOT NULL DEFAULT 0,
  affiliate_code VARCHAR(40) UNIQUE,
  referred_by INT,
  social_provider VARCHAR(40),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS vendors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  email VARCHAR(180) NOT NULL,
  commission_rate INT NOT NULL DEFAULT 15,
  active TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS vendor_payouts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT NOT NULL,
  amount INT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  reference VARCHAR(120),
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT,
  slug VARCHAR(140) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price INT NOT NULL,
  original_price INT NOT NULL,
  rating INT NOT NULL,
  stock INT NOT NULL,
  license_type VARCHAR(80) NOT NULL,
  image_url VARCHAR(500),
  visual_accent VARCHAR(80) NOT NULL DEFAULT 'from-sky-500 to-cyan-400',
  description TEXT,
  hide_price TINYINT NOT NULL DEFAULT 0,
  hide_cart TINYINT NOT NULL DEFAULT 0,
  allowed_countries TEXT,
  blocked_countries TEXT,
  download_url VARCHAR(500),
  video_url VARCHAR(500),
  active TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS product_variants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  sku VARCHAR(80) NOT NULL UNIQUE,
  price INT NOT NULL,
  original_price INT NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  tier_min_qty INT NOT NULL DEFAULT 1,
  tier_label VARCHAR(80),
  is_default TINYINT NOT NULL DEFAULT 0,
  active TINYINT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS license_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  variant_id INT,
  license_key VARCHAR(200) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'available',
  order_id INT,
  assigned_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS coupons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  discount_type VARCHAR(20) NOT NULL DEFAULT 'percent',
  discount_value INT NOT NULL,
  min_amount INT NOT NULL DEFAULT 0,
  max_uses INT,
  used_count INT NOT NULL DEFAULT 0,
  country_codes TEXT,
  product_ids TEXT,
  active TINYINT NOT NULL DEFAULT 1,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS pricing_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  country_code VARCHAR(2),
  product_id INT,
  variant_id INT,
  min_qty INT NOT NULL DEFAULT 1,
  price_override INT,
  currency VARCHAR(3) DEFAULT 'INR',
  payment_methods TEXT,
  shipping_mode VARCHAR(40) DEFAULT 'instant_digital',
  active TINYINT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS carts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  user_id INT,
  email VARCHAR(180),
  country_code VARCHAR(2) DEFAULT 'IN',
  currency VARCHAR(3) DEFAULT 'INR',
  coupon_code VARCHAR(40),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE KEY carts_session (session_id)
);

CREATE TABLE IF NOT EXISTS cart_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cart_id INT NOT NULL,
  product_id INT NOT NULL,
  variant_id INT,
  quantity INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  session_id VARCHAR(64),
  customer_email VARCHAR(180) NOT NULL,
  customer_phone VARCHAR(40),
  country_code VARCHAR(2) DEFAULT 'IN',
  currency VARCHAR(3) DEFAULT 'INR',
  subtotal INT NOT NULL,
  discount INT NOT NULL DEFAULT 0,
  total INT NOT NULL,
  coupon_code VARCHAR(40),
  payment_status VARCHAR(40) NOT NULL,
  payment_method VARCHAR(40),
  razorpay_order_id VARCHAR(120),
  razorpay_payment_id VARCHAR(120),
  confirmation_code VARCHAR(20),
  license_key VARCHAR(200),
  email_sent TINYINT NOT NULL DEFAULT 0,
  whatsapp_sent TINYINT NOT NULL DEFAULT 0,
  affiliate_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  variant_id INT,
  product_name VARCHAR(160) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price INT NOT NULL,
  license_key VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS abandoned_carts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cart_id INT NOT NULL,
  email VARCHAR(180),
  step VARCHAR(40) NOT NULL DEFAULT 'cart',
  follow_up_stage INT NOT NULL DEFAULT 0,
  last_email_at TIMESTAMP NULL,
  recovered TINYINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(180) NOT NULL UNIQUE,
  locale VARCHAR(10) DEFAULT 'en',
  country_code VARCHAR(2),
  confirmed TINYINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS page_views (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  path VARCHAR(300) NOT NULL,
  referrer VARCHAR(500),
  country_code VARCHAR(2),
  locale VARCHAR(10),
  user_agent VARCHAR(300),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS affiliates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  code VARCHAR(40) NOT NULL UNIQUE,
  commission_rate INT NOT NULL DEFAULT 10,
  total_earnings INT NOT NULL DEFAULT 0,
  active TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount INT NOT NULL,
  type VARCHAR(40) NOT NULL,
  reference VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS email_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  to_email VARCHAR(180) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  template VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'sent',
  opened TINYINT NOT NULL DEFAULT 0,
  clicked TINYINT NOT NULL DEFAULT 0,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS support_videos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT,
  title VARCHAR(200) NOT NULL,
  video_url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  locale VARCHAR(10) DEFAULT 'en',
  sort_order INT NOT NULL DEFAULT 0,
  active TINYINT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS confirmation_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  type VARCHAR(40) NOT NULL DEFAULT 'order',
  expires_at TIMESTAMP NULL,
  used TINYINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
