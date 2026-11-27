import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh bg-tan-50 text-olive-900 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-cream border border-tan-200 rounded-xl p-6 space-y-4 shadow-sm">
            <h1 className="font-display text-lg font-bold text-olive-900">
              Something went wrong
            </h1>
            <p className="text-sm text-tan-600 leading-relaxed">
              We ran into an issue loading or syncing your data. Please refresh to try again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-olive-700 hover:bg-olive-800 text-cream rounded-lg text-sm font-semibold cursor-pointer transition-colors"
            >
              Reload Closer
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
