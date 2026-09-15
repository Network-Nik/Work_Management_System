-- Migration: fix_whatsapp_format_constraint
-- Description: Corrects the regex syntax in the staff_profiles_whatsapp_number_format constraint.
-- The previous constraint used '^\\+' which evaluated to requiring a literal backslash.
-- The corrected constraint uses '^\+' which correctly evaluates to a literal plus sign.

ALTER TABLE public.staff_profiles 
  DROP CONSTRAINT IF EXISTS staff_profiles_whatsapp_number_format;

ALTER TABLE public.staff_profiles 
  ADD CONSTRAINT staff_profiles_whatsapp_number_format 
  CHECK (whatsapp_number IS NULL OR whatsapp_number ~ '^\+[1-9][0-9]{7,14}$');

