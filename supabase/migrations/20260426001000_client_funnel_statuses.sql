-- Expande os status do funil de cliente para suportar paywall e pós-pagamento.
DO $$
BEGIN
  -- Remove check antigo (pending/in_review/completed) caso exista.
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'diet_requests_status_check'
      AND conrelid = 'public.diet_requests'::regclass
  ) THEN
    ALTER TABLE public.diet_requests
      DROP CONSTRAINT diet_requests_status_check;
  END IF;

  ALTER TABLE public.diet_requests
    ADD CONSTRAINT diet_requests_status_check
    CHECK (
      status IN (
        'awaiting_payment',
        'processing',
        'awaiting_validation',
        'pending',
        'in_review',
        'completed'
      )
    );
END $$;
