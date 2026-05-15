-- Allow audit inventory adjustments (+ optional manual adjustments) alongside supply/writeoff.
-- Safe to re-run: replaces named CHECK if present.

ALTER TABLE stock_ledger
DROP CONSTRAINT IF EXISTS stock_ledger_movement_type_check;

ALTER TABLE stock_ledger
ADD CONSTRAINT stock_ledger_movement_type_check
CHECK (movement_type IN ('supply', 'writeoff', 'audit_adjustment', 'manual'));
