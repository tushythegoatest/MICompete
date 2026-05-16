import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const isQuotaError = this.state.error?.message?.toLowerCase().includes('quota') || 
                           this.state.error?.message?.toLowerCase().includes('resource_exhausted');
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#09090b] p-4 text-center">
          <div className="bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#27272a] rounded-3xl p-8 max-w-lg w-full flex flex-col items-center shadow-xl">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-500 rounded-2xl flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8" />
            </div>
            
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-4">
              {isQuotaError ? 'Daily Limit Reached' : 'Something went wrong'}
            </h1>
            
            <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              {isQuotaError 
                ? 'The application has exceeded its daily Firebase usage quota. The quota resets every midnight Pacific Time. Please check back tomorrow!'
                : 'An unexpected error occurred in the application. Please try refreshing the page.'}
            </p>

            {!isQuotaError && (
              <div className="text-left w-full bg-slate-100 dark:bg-[#09090b] p-4 rounded-xl overflow-auto text-xs text-slate-500 dark:text-slate-500 mb-6 border border-slate-200 dark:border-slate-800">
                <code>{this.state.error?.message}</code>
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 px-4 bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    // @ts-ignore
    return this.props.children;
  }
}
