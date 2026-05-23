-- Kullanıcılar (admin, yönetici, garson, kasiyer, mutfak)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin','manager','waiter','cashier','kitchen')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Masalar
CREATE TABLE IF NOT EXISTS tables (
  id SERIAL PRIMARY KEY,
  number INTEGER UNIQUE NOT NULL,
  name VARCHAR(50),
  capacity INTEGER DEFAULT 4,
  is_active BOOLEAN DEFAULT true,
  qr_code TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Menü kategorileri
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- Menü ürünleri
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  image_url TEXT,
  is_campaign BOOLEAN DEFAULT false,
  campaign_price NUMERIC(10,2),
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Siparişler
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  table_id INTEGER REFERENCES tables(id),
  waiter_id INTEGER REFERENCES users(id),
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','preparing','ready','delivered','cancelled')),
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sipariş kalemleri
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  note TEXT
);

-- Adisyonlar
CREATE TABLE IF NOT EXISTS bills (
  id SERIAL PRIMARY KEY,
  table_id INTEGER REFERENCES tables(id),
  cashier_id INTEGER REFERENCES users(id),
  total NUMERIC(10,2) NOT NULL,
  payment_method VARCHAR(20) CHECK (payment_method IN ('cash','card','meal_card')),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open','paid')),
  opened_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP
);

-- Adisyon-sipariş ilişkisi
CREATE TABLE IF NOT EXISTS bill_orders (
  bill_id INTEGER REFERENCES bills(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  PRIMARY KEY (bill_id, order_id)
);

-- Mesai kayıtları
CREATE TABLE IF NOT EXISTS shifts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  clock_in TIMESTAMP DEFAULT NOW(),
  clock_out TIMESTAMP,
  note TEXT
);

-- Yönetici bildirimleri
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER REFERENCES users(id),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sistem ayarları
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Varsayılan admin kullanıcısı (şifre: Admin1234! — ilk girişte değiştirilmeli)
INSERT INTO users (name, email, password_hash, role) VALUES
('Admin', 'admin@monetcafe.net', '$2b$10$placeholder_ilk_giriste_degistir', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Varsayılan ayarlar
INSERT INTO settings (key, value) VALUES
('cafe_name', 'Monet Cafe'),
('cafe_type', 'waiter'),
('currency', 'TRY')
ON CONFLICT (key) DO NOTHING;
