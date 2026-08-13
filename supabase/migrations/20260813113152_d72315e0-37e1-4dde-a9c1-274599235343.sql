CREATE TABLE public.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL UNIQUE,
  name text,
  pin_hash text NOT NULL,
  pin_salt text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  max_users integer NOT NULL DEFAULT 2,
  upload_permission text NOT NULL DEFAULT 'everyone',
  download_permission text NOT NULL DEFAULT 'everyone',
  delete_permission text NOT NULL DEFAULT 'owner',
  retention_minutes integer NOT NULL DEFAULT 1440,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  deletion_at timestamptz,
  deleted_at timestamptz,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz
);

CREATE TABLE public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'participant',
  token_hash text NOT NULL UNIQUE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_active timestamptz NOT NULL DEFAULT now(),
  revoked boolean NOT NULL DEFAULT false
);
CREATE INDEX participants_transfer_idx ON public.participants(transfer_id);

CREATE TABLE public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
  filename text NOT NULL,
  size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  storage_path text NOT NULL,
  uploaded_by uuid REFERENCES public.participants(id) ON DELETE SET NULL,
  uploaded_by_name text NOT NULL DEFAULT 'Unknown',
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  ready boolean NOT NULL DEFAULT false
);
CREATE INDEX files_transfer_idx ON public.files(transfer_id);

CREATE TABLE public.deletion_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  confirmed boolean NOT NULL DEFAULT true,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transfer_id, participant_id)
);

CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.participants(id) ON DELETE SET NULL,
  actor_name text NOT NULL DEFAULT 'System',
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_logs_transfer_idx ON public.activity_logs(transfer_id, created_at DESC);

GRANT ALL ON public.transfers TO service_role;
GRANT ALL ON public.participants TO service_role;
GRANT ALL ON public.files TO service_role;
GRANT ALL ON public.deletion_confirmations TO service_role;
GRANT ALL ON public.activity_logs TO service_role;

ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;