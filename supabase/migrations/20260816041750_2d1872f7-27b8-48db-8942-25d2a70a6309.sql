-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- wallets (balance in paise)
CREATE TABLE public.wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  balance_paise BIGINT NOT NULL DEFAULT 0 CHECK (balance_paise >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wallet read" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- wallet ledger
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('topup','purchase','refund')),
  amount_paise BIGINT NOT NULL,
  balance_after_paise BIGINT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX wallet_transactions_user_idx ON public.wallet_transactions(user_id, created_at DESC);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ledger read" ON public.wallet_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- razorpay orders
CREATE TABLE public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_order_id TEXT NOT NULL UNIQUE,
  provider_payment_id TEXT,
  purpose TEXT NOT NULL CHECK (purpose IN ('topup','pack')),
  plan_id TEXT,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','failed')),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payment_orders_user_idx ON public.payment_orders(user_id, created_at DESC);
GRANT SELECT ON public.payment_orders TO authenticated;
GRANT ALL ON public.payment_orders TO service_role;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own orders read" ON public.payment_orders FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- purchased transfer packs
CREATE TABLE public.transfer_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  label TEXT NOT NULL,
  bytes_total BIGINT NOT NULL CHECK (bytes_total > 0),
  bytes_used BIGINT NOT NULL DEFAULT 0 CHECK (bytes_used >= 0),
  max_participants INTEGER NOT NULL DEFAULT 5,
  max_duration_minutes INTEGER NOT NULL DEFAULT 10080,
  price_paise BIGINT NOT NULL,
  paid_with TEXT NOT NULL DEFAULT 'razorpay' CHECK (paid_with IN ('razorpay','wallet')),
  status TEXT NOT NULL DEFAULT 'unused' CHECK (status IN ('unused','active','consumed')),
  transfer_id UUID REFERENCES public.transfers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX transfer_credits_user_idx ON public.transfer_credits(user_id, created_at DESC);
GRANT SELECT ON public.transfer_credits TO authenticated;
GRANT ALL ON public.transfer_credits TO service_role;
ALTER TABLE public.transfer_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own credits read" ON public.transfer_credits FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- transfers gain billing awareness
ALTER TABLE public.transfers
  ADD COLUMN owner_user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  ADD COLUMN credit_id UUID REFERENCES public.transfer_credits(id) ON DELETE SET NULL,
  ADD COLUMN tier TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN capacity_bytes BIGINT NOT NULL DEFAULT 209715200,
  ADD COLUMN used_bytes BIGINT NOT NULL DEFAULT 0;

-- timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER wallets_updated BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER payment_orders_updated BEFORE UPDATE ON public.payment_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER transfer_credits_updated BEFORE UPDATE ON public.transfer_credits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- provision profile + wallet on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email,'user'), '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.wallets (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- atomic wallet debit: prevents negative balance and double charging
CREATE OR REPLACE FUNCTION public.wallet_debit(_user_id UUID, _amount_paise BIGINT, _description TEXT, _reference TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_balance BIGINT;
BEGIN
  IF _amount_paise <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF _reference IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.wallet_transactions WHERE user_id = _user_id AND reference = _reference
  ) THEN
    RAISE EXCEPTION 'duplicate_reference';
  END IF;

  UPDATE public.wallets
     SET balance_paise = balance_paise - _amount_paise
   WHERE user_id = _user_id AND balance_paise >= _amount_paise
   RETURNING balance_paise INTO _new_balance;

  IF _new_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient_funds';
  END IF;

  INSERT INTO public.wallet_transactions (user_id, kind, amount_paise, balance_after_paise, description, reference)
  VALUES (_user_id, 'purchase', -_amount_paise, _new_balance, _description, _reference);

  RETURN _new_balance;
END;
$$;
REVOKE ALL ON FUNCTION public.wallet_debit(UUID, BIGINT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_debit(UUID, BIGINT, TEXT, TEXT) TO service_role;

-- atomic wallet credit (top-up / refund)
CREATE OR REPLACE FUNCTION public.wallet_credit(_user_id UUID, _amount_paise BIGINT, _kind TEXT, _description TEXT, _reference TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_balance BIGINT;
BEGIN
  IF _amount_paise <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF _kind NOT IN ('topup','refund') THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;
  IF _reference IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.wallet_transactions WHERE user_id = _user_id AND reference = _reference
  ) THEN
    RAISE EXCEPTION 'duplicate_reference';
  END IF;

  INSERT INTO public.wallets (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.wallets
     SET balance_paise = balance_paise + _amount_paise
   WHERE user_id = _user_id
   RETURNING balance_paise INTO _new_balance;

  INSERT INTO public.wallet_transactions (user_id, kind, amount_paise, balance_after_paise, description, reference)
  VALUES (_user_id, _kind, _amount_paise, _new_balance, _description, _reference);

  RETURN _new_balance;
END;
$$;
REVOKE ALL ON FUNCTION public.wallet_credit(UUID, BIGINT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_credit(UUID, BIGINT, TEXT, TEXT, TEXT) TO service_role;

-- atomic transfer capacity consumption
CREATE OR REPLACE FUNCTION public.consume_transfer_capacity(_transfer_id UUID, _bytes BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _used BIGINT;
  _credit UUID;
BEGIN
  UPDATE public.transfers
     SET used_bytes = used_bytes + _bytes
   WHERE id = _transfer_id AND used_bytes + _bytes <= capacity_bytes
   RETURNING used_bytes, credit_id INTO _used, _credit;

  IF _used IS NULL THEN
    RAISE EXCEPTION 'capacity_exceeded';
  END IF;

  IF _credit IS NOT NULL THEN
    UPDATE public.transfer_credits SET bytes_used = _used WHERE id = _credit;
  END IF;

  RETURN _used;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_transfer_capacity(UUID, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_transfer_capacity(UUID, BIGINT) TO service_role;