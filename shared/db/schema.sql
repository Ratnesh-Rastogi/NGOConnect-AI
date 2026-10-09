-- NGOConnect AI PostgreSQL schema. Safe to re-run during local development.
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('ngo', 'donor', 'admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE resource_category AS ENUM ('food', 'medicines', 'healthcare_supplies', 'clothing', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE resource_status AS ENUM ('available', 'reserved', 'depleted', 'expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE urgency AS ENUM ('low', 'medium', 'high', 'critical'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE request_status AS ENUM ('open', 'accepted', 'rejected', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE transaction_status AS ENUM ('pending', 'accepted', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_type AS ENUM ('request_created', 'request_accepted', 'request_rejected', 'transaction_completed', 'system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS ngos (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact_email TEXT,
  phone TEXT,
  location TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  verification_status verification_status NOT NULL DEFAULT 'pending',
  trust_score REAL NOT NULL DEFAULT 40,
  address TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  pincode TEXT NOT NULL DEFAULT '',
  registration_number TEXT NOT NULL DEFAULT '',
  pan_tax_id TEXT NOT NULL DEFAULT '',
  legal_description TEXT NOT NULL DEFAULT '',
  website TEXT,
  tax_exemption_details TEXT,
  verified_at TIMESTAMPTZ,
  verified_by INTEGER,
  rejection_reason TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- These ALTERs let the same setup script bring older development databases up to date.
ALTER TABLE ngos ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '';
ALTER TABLE ngos ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT '';
ALTER TABLE ngos ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '';
ALTER TABLE ngos ADD COLUMN IF NOT EXISTS pincode TEXT NOT NULL DEFAULT '';
ALTER TABLE ngos ADD COLUMN IF NOT EXISTS registration_number TEXT NOT NULL DEFAULT '';
ALTER TABLE ngos ADD COLUMN IF NOT EXISTS pan_tax_id TEXT NOT NULL DEFAULT '';
ALTER TABLE ngos ADD COLUMN IF NOT EXISTS legal_description TEXT NOT NULL DEFAULT '';
ALTER TABLE ngos ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE ngos ADD COLUMN IF NOT EXISTS tax_exemption_details TEXT;
ALTER TABLE ngos ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE ngos ADD COLUMN IF NOT EXISTS verified_by INTEGER;
ALTER TABLE ngos ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE ngos ADD COLUMN IF NOT EXISTS admin_notes TEXT;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL,
  ngo_id INTEGER REFERENCES ngos(id) ON DELETE SET NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email);

DO $$ BEGIN
  ALTER TABLE ngos ADD CONSTRAINT ngos_verified_by_users_id_fk FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS resources (
  id SERIAL PRIMARY KEY,
  owner_ngo_id INTEGER NOT NULL REFERENCES ngos(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category resource_category NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  location TEXT NOT NULL,
  expiry_date DATE,
  status resource_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS resources_owner_idx ON resources(owner_ngo_id);
CREATE INDEX IF NOT EXISTS resources_category_idx ON resources(category);
CREATE INDEX IF NOT EXISTS resources_status_idx ON resources(status);
CREATE INDEX IF NOT EXISTS resources_location_idx ON resources(location);

CREATE TABLE IF NOT EXISTS resource_requests (
  id SERIAL PRIMARY KEY,
  requester_ngo_id INTEGER NOT NULL REFERENCES ngos(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  category resource_category,
  quantity REAL NOT NULL,
  urgency urgency NOT NULL,
  location TEXT NOT NULL,
  required_date DATE NOT NULL,
  status request_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS requests_requester_idx ON resource_requests(requester_ngo_id);
CREATE INDEX IF NOT EXISTS requests_status_idx ON resource_requests(status);
CREATE INDEX IF NOT EXISTS requests_urgency_idx ON resource_requests(urgency);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES resource_requests(id) ON DELETE CASCADE,
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  quantity REAL NOT NULL,
  status transaction_status NOT NULL DEFAULT 'accepted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS transactions_request_idx ON transactions(request_id);
CREATE INDEX IF NOT EXISTS transactions_resource_idx ON transactions(resource_id);
CREATE INDEX IF NOT EXISTS transactions_status_idx ON transactions(status);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type notification_type NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS ngos_location_idx ON ngos(location);
CREATE INDEX IF NOT EXISTS ngos_verification_idx ON ngos(verification_status);
