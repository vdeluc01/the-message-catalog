import React from 'react';

// Catch any render-time error and show a recoverable error screen
// so a single bug doesn't blank out the whole app.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    this.setState({ info });
    if (typeof console !== 'undefined') console.error('Catalog render error:', error, info);
  }
  reset = () => this.setState({ error: null, info: null });
  reload = () => window.location.reload();
  render() {
    if (!this.state.error) return this.props.children;
    const msg = (this.state.error && (this.state.error.message || String(this.state.error))) || 'Unknown error';
    return (
      <div style={{ minHeight: '100vh', background: '#080808', color: '#e8dcc8', fontFamily: "Georgia,'Times New Roman',serif", padding: '40px 24px' }}>
        <div style={{ maxWidth: 640, margin: '40px auto', background: '#0f0f0f', border: '1px solid #3a1a1a', borderRadius: 8, padding: '28px 30px' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#C84A4A', textTransform: 'uppercase', marginBottom: 12 }}>Something Broke</div>
          <div style={{ fontSize: 18, color: '#f0e8d8', marginBottom: 14, lineHeight: 1.4 }}>The catalog hit an unexpected error.</div>
          <div style={{ fontSize: 13, color: '#aaa', marginBottom: 18, lineHeight: 1.7 }}>
            Your data is safe — it's stored locally and on Google Drive, not in this view. Click <strong>Try Again</strong> to recover, or <strong>Reload</strong> to start fresh. If this keeps happening, take a screenshot of the technical details below before reporting it.
          </div>
          <div style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: 4, padding: '10px 12px', marginBottom: 18, fontFamily: 'monospace', fontSize: 11, color: '#c55', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={this.reset}
              style={{ background: 'linear-gradient(135deg,#C8942A,#9a7018)', border: 'none', borderRadius: 4, color: '#fff', padding: '10px 20px', fontSize: 12, cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Try Again
            </button>
            <button onClick={this.reload}
              style={{ background: 'transparent', border: '1px solid #333', borderRadius: 4, color: '#bbb', padding: '10px 18px', fontSize: 12, cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
