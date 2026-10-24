import React from 'react';

interface TopbarProps {
  libraryCount: number;
  onToggleLibrary: () => void;
  onOpenTheme: () => void;
  onRunTests: () => void;
  onOpenExport: () => void;
  hasAnalysis: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({
  libraryCount,
  onToggleLibrary,
  onOpenTheme,
  onRunTests,
  onOpenExport,
  hasAnalysis,
}) => {
  return (
    <header className="topbar">
      <div className="shell topbar-inner">
        <div className="brand">
          <div className="logo">D/</div>
          <div>
            <div style={{ lineHeight: 1 }}>DocuWeave</div>
            <small>PDF → Beautiful Webpage • v3</small>
          </div>
          <span
            style={{
              marginLeft: '8px',
              background: '#fff',
              border: '1px solid var(--line)',
              borderRadius: '999px',
              padding: '6px 10px',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '.06em',
            }}
          >
            v3.0 • Library • Themes • Ask
          </span>
        </div>
        <nav className="nav">
          <button className="pill" id="libBtn" onClick={onToggleLibrary}>
            📚 Library{' '}
            <span
              id="libCount"
              style={{
                background: 'var(--ink)',
                color: '#fff',
                borderRadius: '999px',
                padding: '2px 6px',
                fontSize: '11px',
              }}
            >
              {libraryCount}
            </span>
          </button>
          <button className="pill" onClick={onOpenTheme}>
            🎨 Themes
          </button>
          <button className="pill" onClick={onRunTests}>
            ▶ Tests
          </button>
          <button
            className="pill primary"
            id="exportBtn"
            disabled={!hasAnalysis}
            onClick={onOpenExport}
          >
            Export ▾
          </button>
        </nav>
      </div>
    </header>
  );
};
