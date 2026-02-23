import {
  // Games & Entertainment
  BoltIcon,
  PuzzlePieceIcon,
  TrophyIcon,
  StarIcon,
  SparklesIcon,
  RocketLaunchIcon,
  CubeIcon,

  // Development & Technology
  CodeBracketSquareIcon,
  CommandLineIcon,
  CpuChipIcon,
  Cog8ToothIcon,
  WrenchScrewdriverIcon,
  BeakerIcon,
  WifiIcon,
  ServerIcon,
  CircleStackIcon,
  CloudIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,

  // Documents & Content
  DocumentTextIcon,
  BookOpenIcon,
  FolderIcon,
  ArchiveBoxIcon,
  DocumentDuplicateIcon,
  ClipboardDocumentIcon,
  NewspaperIcon,
  DocumentMagnifyingGlassIcon,

  // Communication & Social
  ChatBubbleLeftRightIcon,
  ChatBubbleBottomCenterTextIcon,
  EnvelopeIcon,
  PhoneIcon,
  MegaphoneIcon,
  BellIcon,
  AtSymbolIcon,
  HashtagIcon,

  // Media & Creative
  CameraIcon,
  PhotoIcon,
  VideoCameraIcon,
  MusicalNoteIcon,
  PaintBrushIcon,
  MicrophoneIcon,
  SpeakerWaveIcon,
  FilmIcon,

  // UI & Interface
  HomeIcon,
  Bars3Icon,
  Squares2X2Icon,
  ViewColumnsIcon,
  WindowIcon,
  PresentationChartLineIcon,
  ChartBarIcon,
  ChartPieIcon,

  // Nature & Environment
  SunIcon,
  MoonIcon,
  CloudArrowUpIcon,
  FireIcon,
  GlobeAltIcon,
  GlobeEuropeAfricaIcon,
  BuildingLibraryIcon,
  BuildingOfficeIcon,

  // Actions & Tools
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  PencilIcon,
  TrashIcon,
  ClipboardIcon,

  // Status & Indicators
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  QuestionMarkCircleIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  KeyIcon,
  EyeIcon,

  // Time & Schedule
  ClockIcon,
  CalendarIcon,
  CalendarDaysIcon,
  BellAlertIcon,

  // People & Teams
  UsersIcon,
  UserGroupIcon,
  UserCircleIcon,
  IdentificationIcon,
  AcademicCapIcon,
  HeartIcon,
  HandThumbUpIcon,
  FaceSmileIcon,

  // Navigation & Location
  MapIcon,
  MapPinIcon,
  GlobeAsiaAustraliaIcon,
  PaperAirplaneIcon,
  SignalIcon,

  // Finance & Commerce
  CurrencyDollarIcon,
  BanknotesIcon,
  CreditCardIcon,
  ReceiptPercentIcon,
  ShoppingCartIcon,
  ShoppingBagIcon,
  TagIcon,
  TicketIcon,

  // Science & Education
  CalculatorIcon,
  ChartBarSquareIcon,
  LightBulbIcon,
  MagnifyingGlassCircleIcon,
  ScaleIcon,
  VariableIcon,
  CubeTransparentIcon,

  // Miscellaneous
  GiftIcon,
  CakeIcon,
  FlagIcon,
  LanguageIcon,
  PaperClipIcon,
  PrinterIcon,
  QrCodeIcon,
  RssIcon,
  ShareIcon,
  SignalSlashIcon,
  Cog6ToothIcon,
  WrenchIcon,
  BugAntIcon,
  LifebuoyIcon,
  XMarkIcon,

  // Additional useful icons
  SwatchIcon,
  TableCellsIcon,
  RectangleGroupIcon,
  Square3Stack3DIcon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';

export type IconName = keyof typeof iconRegistry;

// Map icon names to their Heroicon components
export const iconRegistry = {
  // Games & Entertainment
  bolt: BoltIcon,
  'puzzle-piece': PuzzlePieceIcon,
  trophy: TrophyIcon,
  star: StarIcon,
  sparkles: SparklesIcon,
  'rocket-launch': RocketLaunchIcon,
  cube: CubeIcon,
  moon: MoonIcon,

  // Development & Technology
  'code-bracket-square': CodeBracketSquareIcon,
  'command-line': CommandLineIcon,
  'cpu-chip': CpuChipIcon,
  'cog-8-tooth': Cog8ToothIcon,
  'wrench-screwdriver': WrenchScrewdriverIcon,
  beaker: BeakerIcon,
  wifi: WifiIcon,
  server: ServerIcon,
  'circle-stack': CircleStackIcon,
  cloud: CloudIcon,
  'computer-desktop': ComputerDesktopIcon,
  'device-phone-mobile': DevicePhoneMobileIcon,

  // Documents & Content
  'document-text': DocumentTextIcon,
  'book-open': BookOpenIcon,
  folder: FolderIcon,
  'archive-box': ArchiveBoxIcon,
  'document-duplicate': DocumentDuplicateIcon,
  'clipboard-document': ClipboardDocumentIcon,
  newspaper: NewspaperIcon,
  'document-magnifying-glass': DocumentMagnifyingGlassIcon,

  // Communication & Social
  'chat-bubble-left-right': ChatBubbleLeftRightIcon,
  'chat-bubble-bottom-center-text': ChatBubbleBottomCenterTextIcon,
  envelope: EnvelopeIcon,
  phone: PhoneIcon,
  megaphone: MegaphoneIcon,
  bell: BellIcon,
  'at-symbol': AtSymbolIcon,
  hashtag: HashtagIcon,

  // Media & Creative
  camera: CameraIcon,
  photo: PhotoIcon,
  'video-camera': VideoCameraIcon,
  'musical-note': MusicalNoteIcon,
  'paint-brush': PaintBrushIcon,
  microphone: MicrophoneIcon,
  'speaker-wave': SpeakerWaveIcon,
  film: FilmIcon,

  // UI & Interface
  home: HomeIcon,
  'bars-3': Bars3Icon,
  'squares-2x2': Squares2X2Icon,
  'view-columns': ViewColumnsIcon,
  window: WindowIcon,
  'presentation-chart-line': PresentationChartLineIcon,
  'chart-bar': ChartBarIcon,
  'chart-pie': ChartPieIcon,

  // Nature & Environment
  sun: SunIcon,
  'cloud-arrow-up': CloudArrowUpIcon,
  fire: FireIcon,
  'globe-alt': GlobeAltIcon,
  'globe-europe-africa': GlobeEuropeAfricaIcon,
  'building-library': BuildingLibraryIcon,
  'building-office': BuildingOfficeIcon,

  // Actions & Tools
  'magnifying-glass': MagnifyingGlassIcon,
  'adjustments-horizontal': AdjustmentsHorizontalIcon,
  'arrow-path': ArrowPathIcon,
  'arrow-down-tray': ArrowDownTrayIcon,
  'arrow-up-tray': ArrowUpTrayIcon,
  pencil: PencilIcon,
  trash: TrashIcon,
  clipboard: ClipboardIcon,

  // Status & Indicators
  'check-circle': CheckCircleIcon,
  'exclamation-triangle': ExclamationTriangleIcon,
  'information-circle': InformationCircleIcon,
  'question-mark-circle': QuestionMarkCircleIcon,
  'shield-check': ShieldCheckIcon,
  'lock-closed': LockClosedIcon,
  key: KeyIcon,
  eye: EyeIcon,

  // Time & Schedule
  clock: ClockIcon,
  calendar: CalendarIcon,
  'calendar-days': CalendarDaysIcon,
  'bell-alert': BellAlertIcon,
  stopwatch: ClockIcon, // Using ClockIcon as fallback

  // People & Teams
  users: UsersIcon,
  'user-group': UserGroupIcon,
  'user-circle': UserCircleIcon,
  identification: IdentificationIcon,
  'academic-cap': AcademicCapIcon,
  heart: HeartIcon,
  'hand-thumb-up': HandThumbUpIcon,
  'face-smile': FaceSmileIcon,

  // Navigation & Location
  map: MapIcon,
  'map-pin': MapPinIcon,
  'globe-asia-australia': GlobeAsiaAustraliaIcon,
  compass: MapIcon, // Using MapIcon as fallback
  'paper-airplane': PaperAirplaneIcon,
  signal: SignalIcon,

  // Finance & Commerce
  'currency-dollar': CurrencyDollarIcon,
  banknotes: BanknotesIcon,
  'credit-card': CreditCardIcon,
  'receipt-percent': ReceiptPercentIcon,
  'shopping-cart': ShoppingCartIcon,
  'shopping-bag': ShoppingBagIcon,
  tag: TagIcon,
  ticket: TicketIcon,

  // Science & Education
  calculator: CalculatorIcon,
  'chart-bar-square': ChartBarSquareIcon,
  'light-bulb': LightBulbIcon,
  'magnifying-glass-circle': MagnifyingGlassCircleIcon,
  scale: ScaleIcon,
  variable: VariableIcon,
  'cube-transparent': CubeTransparentIcon,

  // Miscellaneous
  gift: GiftIcon,
  cake: CakeIcon,
  flag: FlagIcon,
  language: LanguageIcon,
  'paper-clip': PaperClipIcon,
  printer: PrinterIcon,
  'qr-code': QrCodeIcon,
  rss: RssIcon,
  share: ShareIcon,
  'signal-slash': SignalSlashIcon,
  'cog-6-tooth': Cog6ToothIcon,
  wrench: WrenchIcon,
  'bug-ant': BugAntIcon,
  lifebuoy: LifebuoyIcon,
  'x-mark': XMarkIcon,

  // Additional useful icons
  swatch: SwatchIcon,
  'table-cells': TableCellsIcon,
  'rectangle-group': RectangleGroupIcon,
  'square-3-stack-3d': Square3Stack3DIcon,
  'list-bullet': ListBulletIcon,
} as const;

// Current category to icon mapping (for migration and fallbacks)
export const categoryIconMapping = {
  noxii: 'bolt',
  development: 'code-bracket-square',
  community: 'users',
  tutorials: 'book-open',
  library: 'building-library',
  systems: 'cpu-chip',
  autumn: 'heart',
  'on-command': 'signal',
  dodec: 'cog-8-tooth',
  'project-coalesce': 'map',
  'cosmic-knights': 'moon',
  modding: 'wrench-screwdriver',
  archive: 'archive-box',
  journals: 'document-text',
  uncategorized: 'folder',
} as const;

// Organized icon groups for the selector UI
export const iconGroups = {
  Games: [
    'bolt',
    'puzzle-piece',
    'trophy',
    'star',
    'sparkles',
    'rocket-launch',
    'cube',
    'moon',
    'fire',
  ],
  Development: [
    'code-bracket-square',
    'command-line',
    'cpu-chip',
    'cog-8-tooth',
    'wrench-screwdriver',
    'beaker',
    'wifi',
    'server',
    'circle-stack',
    'cloud',
    'computer-desktop',
    'device-phone-mobile',
    'bug-ant',
    'wrench',
    'cog-6-tooth',
    'key',
  ],
  Content: [
    'book-open',
    'document-text',
    'academic-cap',
    'building-library',
    'paint-brush',
    'camera',
    'video-camera',
    'musical-note',
  ],
  Community: [
    'users',
    'user-group',
    'chat-bubble-left-right',
    'heart',
    'megaphone',
    'paper-airplane',
    'signal',
  ],
  Organization: [
    'folder',
    'archive-box',
    'map',
    'home',
    'globe-alt',
    'clock',
    'eye',
    'information-circle',
    'light-bulb',
    'table-cells',
    'rectangle-group',
    'square-3-stack-3d',
    'list-bullet',
    'swatch',
  ],
} as const;

// Get icon component by name with fallback
export function getIconComponent(iconName: string | null): React.ComponentType<any> {
  if (!iconName || !(iconName in iconRegistry)) {
    return iconRegistry['folder']; // Default fallback
  }
  return iconRegistry[iconName as IconName];
}

// Get display name for icon
export function getIconDisplayName(iconName: string): string {
  return iconName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Get all available icon names
export function getAllIconNames(): IconName[] {
  return Object.keys(iconRegistry) as IconName[];
}

// Get icons by group
export function getIconsByGroup(groupName: keyof typeof iconGroups): IconName[] {
  return [...iconGroups[groupName]] as IconName[];
}
