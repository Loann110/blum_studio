// Icons: Lucide (ISC licence, see THIRD_PARTY_NOTICES.md) via data-lucide.
// Only the icons the editor uses are bundled (the full set weighs ~900 KB).
import {
  createIcons,
  Type,
  Undo2,
  Redo2,
  File,
  Grid,
  X,
  Move,
  Shapes,
  Images,
  Search,
  Layers,
  Save,
  Download,
  Copy,
  Lock,
  Keyboard,
  Group,
  Ungroup,
  Italic,
  Underline,
  Sun,
  Moon,
  Sticker,
  Image,
  Pipette,
  Shield,
  FolderOpen,
  Eye,
  Minus,
  Plus,
  Menu,
  FilePlus,
  Triangle,
  Star,
  Heart,
  FileText,
  Pencil,
  EyeOff,
  LockOpen,
  CaseUpper,
  TextAlignStart,
  TextAlignCenter,
  TextAlignEnd,
  Square,
  Circle,
  Scan,
  Scissors,
  Upload,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  BringToFront,
  ChevronDown,
  ChevronUp,
  SendToBack,
  Trash,
  Contrast,
  Ellipsis,
  UnfoldVertical,
  ArrowLeft,
  KeyRound,
  Spline,
  type IconNode,
} from 'lucide';

// Mask shapes Lucide has no icon for, drawn on its 24 px grid with its stroke
// rules so they size and recolour like the rest. Blob is exaggerated from the
// real mask: drawn exactly, it reads as a circle at toolbar size.
const MaskArch: IconNode = [['path', { d: 'M4 21V11a8 8 0 0 1 16 0v10Z' }]];
const MaskBlob: IconNode = [
  ['path', { d: 'M9 2.2C12.8 0.9 17.6 2 20 5C22.3 7.9 22.2 11.6 20.8 14.2C19.8 16 18.4 16.8 17.6 19C16.6 21.6 13.4 22.6 10.2 21.6C7.8 20.9 6.7 19.3 4.6 18.2C2.1 16.9 1.5 13.6 2.2 10.8C2.8 8.4 4.3 7.4 4.9 5.3C5.5 3.6 7 2.7 9 2.2Z' }],
];

const ICONS = {
  MaskArch,
  MaskBlob,
  Type,
  Undo2,
  Redo2,
  File,
  Grid,
  X,
  Move,
  Shapes,
  Images,
  Search,
  Layers,
  Save,
  Download,
  Copy,
  Lock,
  Keyboard,
  Group,
  Ungroup,
  Italic,
  Underline,
  Sun,
  Moon,
  Sticker,
  Image,
  Pipette,
  Shield,
  FolderOpen,
  Eye,
  Minus,
  Plus,
  Menu,
  FilePlus,
  Triangle,
  Star,
  Heart,
  FileText,
  Pencil,
  EyeOff,
  LockOpen,
  CaseUpper,
  TextAlignStart,
  TextAlignCenter,
  TextAlignEnd,
  Square,
  Circle,
  Scan,
  Scissors,
  Upload,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  BringToFront,
  ChevronDown,
  ChevronUp,
  SendToBack,
  Trash,
  Contrast,
  Ellipsis,
  UnfoldVertical,
  ArrowLeft,
  KeyRound,
  Spline,
};

/** Converts the icons inside `root` right now (for a bar built off-screen before it is shown). */
export function iconsIn(root: Element): void {
  try {
    createIcons({ icons: ICONS, root });
  } catch {
    /* icons stay as empty placeholders */
  }
}

let queued = 0;

/** Replace every <i data-lucide> in the document with its SVG icon. */
export function refreshIcons(): void {
  window.clearTimeout(queued);
  // Batch synchronous calls from one render pass into a single sweep.
  queued = window.setTimeout(() => {
    try {
      createIcons({ icons: ICONS });
    } catch {
      /* icons stay as empty placeholders */
    }
  }, 0);
}
