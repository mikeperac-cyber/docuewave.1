import React from 'react';
import { Theme } from '../types';
import { themes } from '../utils/engine';

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: string;
  onSelectTheme: (id: string) => void;
  accentColor: string;
  onAccentChange: (val: string) => void;
}

export const ThemeModal: React.FC<ThemeModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onSelectTheme,
  accentColor,
  onAccentChange,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="modal open"
      id="themeModal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card">
        <div className="modal-head">
          <b>🎨 Theme Studio — choose a vibe for your webpage</b>
          <button className="pill" onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={{ padding: '14px' }}>
          <div className="theme-picker" id="themePicker">
            {themes.map((t) => (
              <div
                key={t.id}
                className={`theme-opt ${currentTheme === t.id ? 'on' : ''}`}
                onClick={() => onSelectTheme(t.id)}
              >
                <div className="sw" style={{ background: t.sw }} />
                <b style={{ fontSize: '12px' }}>{t.name}</b>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  {t.bg} • {t.ink}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: '12px',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <label style={{ fontSize: '12px', fontWeight: 700 }}>
              Accent{' '}
              <input
                type="color"
                id="accentPick"
                value={accentColor}
                onChange={(e) => onAccentChange(e.target.value)}
                style={{
                  width: '36px',
                  height: '28px',
                  border: '1px solid var(--line)',
                  borderRadius: '8px',
                  padding: '2px',
                }}
              />
            </label>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
              Themes change exported HTML too. Pro tip: Editorial for reports, Swiss for decks, Dark for focus.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
