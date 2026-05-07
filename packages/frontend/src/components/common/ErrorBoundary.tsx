import React from 'react';
import { Button, Result } from 'antd';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom fallback UI rendered in place of the error page */
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary - Catches JavaScript errors anywhere in its child component tree,
 * logs those errors, and renders a fallback UI instead of the crashed component tree.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log the error for debugging/monitoring
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      // If a custom fallback is provided, render it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Otherwise render the default error UI
      return (
        <Result
          status="error"
          title="页面出现了异常"
          subTitle={
            this.state.error?.message || '发生了意外错误，请尝试刷新页面'
          }
          extra={
            <Button type="primary" onClick={this.handleReset}>
              重试
            </Button>
          }
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
