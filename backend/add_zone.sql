ALTER TABLE tables ADD COLUMN IF NOT EXISTS zone VARCHAR(50) DEFAULT 'İçeri';

UPDATE tables SET zone = 'İçeri' WHERE zone IS NULL;
