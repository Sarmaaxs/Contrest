import { useState, useCallback } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import AuthScreen from '@/components/auth/AuthScreen';
import AppShell from '@/components/layout/AppShell';
import SplashScreen from '@/components/shared/SplashScreen';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';

function Root() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const [wizardDone, setWizardDone] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  const finishSplash = useCallback(() => {
    setSplashDone(true);
  }, []);

  if (!splashDone) {
    return <SplashScreen onDone={finishSplash} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen app-glow-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/15 border-t-drop-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen app-glow-bg flex items-center justify-center px-4">
        <div className="glass-strong rounded-2xl p-6 max-w-sm w-full text-center">
          <p className="text-white font-medium mb-1">Setting up your account…</p>
          <p className="text-sm text-neutral-400 mb-5">
            You&apos;re signed in, but we couldn&apos;t find your profile yet. Try again in a moment.
          </p>
          <button
            onClick={refreshProfile}
            className="w-full bg-gradient-to-r from-drop-500 to-drop-600 text-white py-2.5 rounded-lg text-sm font-medium hover:brightness-110 mb-2"
          >
            Try again
          </button>
          <button onClick={signOut} className="w-full text-sm text-neutral-400 hover:text-white py-2">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (profile.onboarded === false && !wizardDone) {
    return <OnboardingWizard onDone={() => setWizardDone(true)} />;
  }

  return <AppShell />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Root />
      </ToastProvider>
    </AuthProvider>
  );
}
