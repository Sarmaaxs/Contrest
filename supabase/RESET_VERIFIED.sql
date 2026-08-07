-- If every profile shows a blue check by mistake, reset then re-verify only yourself:
UPDATE public.profiles SET is_verified = false;
UPDATE public.profiles SET is_verified = true WHERE username = 'YOUR_USERNAME';

