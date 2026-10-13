import { Component } from 'react';
import { useRouteError, Link } from 'react-router-dom';
import { ErrorState } from '@/components/common/States';

/** Catches render errors in a page so the shell stays usable. Never shows stack traces. */
export class RouteErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (import.meta.env.DEV) console.error('Page error:', error);
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card">
        <ErrorState
          title="This page hit a problem"
          message="Something unexpected happened while showing this page."
          onRetry={() => this.setState({ error: null })}
        />
      </div>
    );
  }
}

/** Router-level errorElement (e.g. a lazy chunk failed to load). */
export function RouterErrorPage() {
  const error = useRouteError();
  return (
    <div className="grid min-h-screen place-items-center bg-canvas p-6">
      <div className="card max-w-md text-center">
        <ErrorState
          title="Something went wrong"
          message={error?.statusText || 'The page couldn’t be displayed. Try reloading.'}
          onRetry={() => window.location.reload()}
        />
        <Link to="/" className="mb-6 inline-block text-sm font-medium text-accent-600 hover:underline">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
