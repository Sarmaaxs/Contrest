import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/shared/ErrorBoundary.tsx';
import CookieConsent from './components/shared/CookieConsent.tsx';
import { Analytics } from '@vercel/analytics/react';
import { hasAnalyticsConsent } from './lib/consent.ts';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <CookieConsent />
      {hasAnalyticsConsent() && <Analytics />}
    </ErrorBoundary>
  </StrictMode>
);
