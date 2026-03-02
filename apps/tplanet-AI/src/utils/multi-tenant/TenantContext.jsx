/**
 * Tenant Context - Provides tenant information throughout the app.
 * All tenant-specific config (hosters, departments, etc.) comes from backend API.
 */
import { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { detectTenant, setTenantOverride } from './tenantDetector';
import { getContrastColor } from './colorUtils';

// Default tenant configuration
const DEFAULT_CONFIG = {
  tenant_id: 'default',
  name: 'TPlanet',
  features: { ai_secretary: true, nft: true },
  theme: { primary_color: '#3b82f6', secondary_color: '#1e40af' },
};

const TenantContext = createContext(null);

/**
 * Hook to access tenant context.
 * @returns {{ tenant: string, config: object, loading: boolean, error: Error|null, setTenant: function }}
 */
export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

/**
 * Hook to check if a feature is enabled for current tenant.
 * @param {string} featureName - Feature name to check
 * @returns {boolean} Whether feature is enabled
 */
export function useFeature(featureName) {
  const { config } = useTenant();
  return config?.features?.[featureName] ?? false;
}

/**
 * Hook to get tenant theme values.
 * @returns {{ primaryColor: string, secondaryColor: string }}
 */
export function useTenantTheme() {
  const { config } = useTenant();
  const primaryColor = config?.theme?.primary_color || '#3b82f6';
  return {
    primaryColor,
    secondaryColor: config?.theme?.secondary_color || '#1e40af',
    contrastColor: getContrastColor(primaryColor),
  };
}

/**
 * Hook to get tenant hosters (site admin emails).
 * Returns hosters from tenant config (backend).
 * @returns {string[]} Array of hoster emails
 */
export function useHosters() {
  const context = useContext(TenantContext);
  const hosters = context?.config?.hosters;
  if (Array.isArray(hosters) && hosters.length > 0) {
    return hosters;
  }
  return [];
}

/**
 * Hook to get tenant departments (local teams).
 * Returns departments from tenant config (backend), falls back to empty array.
 * @returns {string[]} Array of department names
 */
export function useDepartments() {
  const context = useContext(TenantContext);
  const departments = context?.config?.departments;
  if (Array.isArray(departments) && departments.length > 0) {
    return departments;
  }
  return [];
}

/**
 * Hook to get tenant superusers (users with full admin + member access).
 * @returns {string[]} Array of superuser emails
 */
export function useSuperusers() {
  const context = useContext(TenantContext);
  const superusers = context?.config?.superusers;
  if (Array.isArray(superusers) && superusers.length > 0) {
    return superusers;
  }
  return [];
}

/**
 * Hook to get tenant districts (administrative divisions for dropdown).
 * @returns {Array<{value: string, label: string}>} Array of district options
 */
export function useDistricts() {
  const context = useContext(TenantContext);
  const districts = context?.config?.districts;
  if (Array.isArray(districts) && districts.length > 0) {
    return districts;
  }
  return [];
}

/**
 * Hook to get tenant regions (geographic data for maps).
 * @returns {{ center: [number, number], zoom: number, cities: Array }} Region data
 */
export function useRegions() {
  const context = useContext(TenantContext);
  const regions = context?.config?.regions;
  if (regions && typeof regions === 'object') {
    return regions;
  }
  return { center: [120.9, 23.9], zoom: 10, cities: [] };
}

/**
 * Hook to get tenant brand name (for footer/copyright).
 * @returns {string} Brand name
 */
export function useBrandName() {
  const context = useContext(TenantContext);
  return context?.config?.brandName || context?.config?.name || 'TPlanet';
}

/**
 * Hook to get tenant social links.
 * @returns {{ facebook?: string, youtube?: string }} Social media URLs
 */
export function useSocialLinks() {
  const context = useContext(TenantContext);
  return context?.config?.socialLinks || {};
}

/**
 * Hook to get tenant logo URL.
 * @returns {string} Logo URL (empty string if not set)
 */
export function useLogoUrl() {
  const context = useContext(TenantContext);
  return context?.config?.logoUrl || '';
}

/**
 * Hook to get tenant privacy policy URL.
 * @returns {string} Privacy policy URL
 */
export function usePrivacyUrl() {
  const context = useContext(TenantContext);
  return context?.config?.privacyUrl || '';
}

/**
 * Create initial state for tenant context.
 */
function createInitialState() {
  const tenantId = detectTenant();
  return {
    tenant: tenantId,
    config: { ...DEFAULT_CONFIG, tenant_id: tenantId },
    loading: true,
    error: null,
  };
}

export { TenantContext, DEFAULT_CONFIG, createInitialState, setTenantOverride };
