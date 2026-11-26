import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Something went wrong' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Contrest crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen app-glow-bg flex items-center justify-center p-6 text-white text-center">
          <div className="max-w-sm">
            <p className="text-4xl mb-4">😵</p>
            <h1 className="text-lg font-semibold mb-2">Something broke</h1>
            <p className="text-sm text-neutral-400 mb-6">
              This screen hit an unexpected error instead of loading. Your account and data are fine — try reloading.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-lg bg-accent-grad text-white text-sm font-medium hover:brightness-110"
            >
              Reload Contrest
            </button>
            {import.meta.env.DEV && (
              <p className="text-[11px] text-neutral-600 mt-4">{this.state.message}</p>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
