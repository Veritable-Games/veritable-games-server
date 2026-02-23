/**
 * Settings UI Components
 * Export all unified design system components for settings pages
 */

// Section components
export { SettingsSection, SettingsSectionGroup, SettingsSectionDivider } from './SettingsSection';

// Input components
export { SettingsInput, SettingsPasswordInput, SettingsTextarea } from './SettingsInput';

// Select components
export { SettingsSelect, SettingsMultiSelect } from './SettingsSelect';

// Toggle components
export { SettingsToggle, SettingsToggleGroup, SettingsCompactToggle } from './SettingsToggle';

// Button components
export {
  SettingsButton,
  SettingsButtonGroup,
  SettingsIconButton,
  SettingsSaveButton,
} from './SettingsButton';

// Error and success display components
export { SettingsErrorDisplay, FieldErrorDisplay, SettingsToast } from './SettingsErrorDisplay';

// Auto-save indicator component
export { AutoSaveIndicator } from './AutoSaveIndicator';

// Container components
export {
  SettingsContainer,
  SettingsContentContainer,
  SettingsSidebarContainer,
  SettingsMobileContainer,
  SettingsTabContainer,
  SettingsLayoutContainer,
  SettingsHeaderContainer,
} from './SettingsContainer';

// Icon components
export {
  SettingsIcon,
  UserIcon,
  ShieldIcon,
  KeyIcon,
  LockIcon,
  CogIcon,
  SETTINGS_ICONS,
} from './SettingsIcons';

// Re-export types
export type { SelectOption } from './SettingsSelect';
export type { ToggleOption } from './SettingsToggle';
export type { SettingsIconName } from './SettingsIcons';
