-- Orders tablosu güncellemeleri
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kitchen_user_id INTEGER REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kitchen_started_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS waiter_id INTEGER REFERENCES users(id);

-- Bills tablosu güncellemeleri
ALTER TABLE bills ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS note TEXT;

-- Hesap bölme için yeni tablo
CREATE TABLE IF NOT EXISTS bill_items (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER REFERENCES bills(id) ON DELETE CASCADE,
  order_item_id INTEGER REFERENCES order_items(id) ON DELETE CASCADE,
  is_paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMP,
  payment_method VARCHAR(20)
);

-- Bildirimler tablosu güncellemesi
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_role VARCHAR(20) DEFAULT 'manager';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'info';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN DEFAULT false;
