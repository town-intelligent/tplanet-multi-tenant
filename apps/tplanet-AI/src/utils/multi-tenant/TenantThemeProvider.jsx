/**
 * TenantThemeProvider - Injects CSS variables based on tenant theme.
 */
import { useEffect } from 'react';
import { useTenant } from './TenantContext';
import { getContrastColor } from './colorUtils';

// CSS variable mapping from theme config
const CSS_VAR_MAP = {
  primary_color: '--tenant-primary',
  secondary_color: '--tenant-secondary',
  accent_color: '--tenant-accent',
  background_color: '--tenant-bg',
  text_color: '--tenant-text',
  banner_bg: '--tenant-banner-bg',
  header_bg: '--tenant-header-bg',
};

/**
 * Apply theme CSS variables to document root.
 * @param {object} theme - Theme configuration
 */
function applyThemeVariables(theme) {
  if (!theme) return;

  const root = document.documentElement;

  Object.entries(CSS_VAR_MAP).forEach(([key, cssVar]) => {
    if (theme[key]) {
      root.style.setProperty(cssVar, theme[key]);
    }
  });

  // Set derived variables
  if (theme.primary_color) {
    root.style.setProperty('--tenant-primary-light', `${theme.primary_color}20`);
    root.style.setProperty('--tenant-primary-dark', theme.secondary_color || theme.primary_color);
    root.style.setProperty('--tenant-primary-contrast', getContrastColor(theme.primary_color));
  }
}

/**
 * TenantThemeProvider component.
 * Wraps children and applies tenant theme as CSS variables.
 */
export function TenantThemeProvider({ children, showBanner = false }) {
  const { tenant, config, loading } = useTenant();

  // Apply CSS variables when theme changes
  useEffect(() => {
    if (!loading && config?.theme) {
      applyThemeVariables(config.theme);
    }
  }, [config?.theme, loading]);

  // Optional tenant banner for debugging
  const banner = showBanner && !loading ? (
    <div
      style={{
        backgroundColor: config?.theme?.secondary_color || '#1e40af',
        color: 'white',
        padding: '4px 16px',
        fontSize: '12px',
        textAlign: 'center',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
      }}
    >
      🏢 {config?.name || tenant} | Tenant: {tenant}
    </div>
  ) : null;

  return (
    <>
      {banner}
      <div style={showBanner ? { marginTop: '24px' } : undefined}>
        {children}
      </div>
    </>
  );
}

export default TenantThemeProvider;
