/**
 * Multi-tenant utilities for React.
 *
 * Usage:
 *   import { TenantProvider, TenantThemeProvider, useTenant, useFeature } from '@/utils/multi-tenant';
 *
 *   function App() {
 *     return (
 *       <TenantProvider configUrl="/api/tenant/{tenant}/config">
 *         <TenantThemeProvider showBanner={isDev}>
 *           <YourApp />
 *         </TenantThemeProvider>
 *       </TenantProvider>
 *     );
 *   }
 *
 *   function Component() {
 *     const { tenant, config } = useTenant();
 *     const hasAI = useFeature('ai_secretary');
 *     // ...
 *   }
 */

// Context and hooks
export { useTenant, useFeature, useTenantTheme, useHosters, useDepartments, useSuperusers, useDistricts, useRegions, useBrandName, useLogoUrl, useSocialLinks, usePrivacyUrl, TenantContext } from './TenantContext';
export { useAccessLevel, ACCESS_LEVEL } from './useAccessLevel';

// Providers
export { TenantProvider } from './TenantProvider';
export { TenantThemeProvider } from './TenantThemeProvider';

// Utilities
export {
  detectTenant,
  detectTenantFromHostname,
  detectTenantFromHeader,
  detectTenantFromStorage,
  setTenantOverride,
} from './tenantDetector';
export { getContrastColor } from './colorUtils';

// Default export for convenience
export { TenantProvider as default } from './TenantProvider';
