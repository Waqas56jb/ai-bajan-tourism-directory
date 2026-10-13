import { Component } from 'react';
import { ErrorState } from './States';
import { Button } from './Button';

/**
 * Catches render errors so one broken section doesn't blank the whole site. Shows a friendly
 * message — never a stack trace. `resetKey` (e.g. the pathname) clears the error on navigation.
 */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) console.error('UI error boundary caught:', error, info);
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="container-page py-20">
        <ErrorState
          title="This page hit a snag"
          message="Something unexpected happened while showing this page. You can try again or head back to the homepage."
          onRetry={() => this.setState({ error: null })}
          action={
            <Button variant="outline" to="/">
              Go to homepage
            </Button>
          }
        />
      </div>
    );
  }
}
