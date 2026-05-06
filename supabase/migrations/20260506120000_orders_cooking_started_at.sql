-- Время входа заказа в статус «готовится» для KDS-таймера
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cooking_started_at timestamptz;

CREATE OR REPLACE FUNCTION public.orders_touch_cooking_started_at()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'cooking' THEN
      NEW.cooking_started_at := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'cooking' AND (OLD.status IS DISTINCT FROM 'cooking') THEN
      NEW.cooking_started_at := now();
    ELSIF NEW.status <> 'cooking' THEN
      NEW.cooking_started_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_touch_cooking_started_at ON public.orders;

CREATE TRIGGER orders_touch_cooking_started_at
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_touch_cooking_started_at();
