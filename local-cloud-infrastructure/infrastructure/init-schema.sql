CREATE TABLE IF NOT EXISTS storage_events (
  id SERIAL PRIMARY KEY,
  path VARCHAR(255) NOT NULL,
  total_space BIGINT NOT NULL,
  used_space BIGINT NOT NULL,
  free_space BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stream_events (
  id SERIAL PRIMARY KEY,
  camera_id VARCHAR(50) NOT NULL,
  session_id VARCHAR(50) NOT NULL,
  event VARCHAR(20) NOT NULL,
  bytes_written BIGINT NOT NULL,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS backup_events (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  bytes_written BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  token_hash VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_storage_created ON storage_events(created_at);
CREATE INDEX IF NOT EXISTS idx_stream_created ON stream_events(created_at);
CREATE INDEX IF NOT EXISTS idx_backup_created ON backup_events(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
