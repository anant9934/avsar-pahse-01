# Avsar Design System & UI Tokens

## Color Tokens

| Token Name | Value | Purpose |
|---|---|---|
| `--color-surface-bg` | `#F8F6F1` | Primary screen surface (Warm Ivory) |
| `--color-surface-container` | `#EDEAE3` | Outer viewport container (Warm Grey) |
| `--color-surface-card` | `#FFFFFF` | Elevated card components |
| `--color-primary` | `#285C45` | Forest Green primary CTA and highlights |
| `--color-primary-hover` | `#1E4735` | Active and hover button states |
| `--color-text-main` | `#242720` | High-contrast body and heading typography |
| `--color-text-muted` | `#77786F` | Secondary timestamps, labels, and placeholders |
| `--color-border-card` | `#ECEAE3` | Subtle card borders |

## Typography Scale

- **Display Heading**: 24px–28px, Bold / Serif accent, line-height 1.2
- **Section Heading**: 18px–20px, Bold, line-height 1.3
- **Card Title**: 14px–16px, Semi-Bold, line-height 1.4
- **Body Text**: 12px–13px, Regular, line-height 1.5
- **Caption / Badge**: 10px–11px, Medium / Semi-Bold, uppercase tracking

## Component Standards

### 1. Job Card (`JobCard`)
- 16px padding on mobile, rounded 24px (`rounded-3xl`).
- Dynamic match percentage pill with semantic color thresholding:
  - 88%+ : Strong Match (`bg-[#EAF4EB] text-[#285C45]`)
  - 72%–87% : Good Match (`bg-[#FEF7EA] text-[#B27715]`)
  - <72% : Moderate Match (`bg-[#F4F2EC] text-[#55564F]`)
- Company brand logo avatar (44px) with fallback monogram.
- Batch year eligibility pill (`Batch '24, '25`).

### 2. Mobile Shell (`MobileShell`)
- Centers mobile container on desktop monitors (`max-w-[420px]`).
- Includes floating device frame switcher for developer QA:
  - Phone Frame (Fixed 390px/420px)
  - Fluid Tablet/Desktop Frame (Full-width responsive layout)
- Accessible "Skip to main content" banner for keyboard accessibility.

### 3. Touch Accessibility
- Minimum interactive touch target: 44px by 44px (`.touch-target-min`).
- Clear keyboard focus indicators with 2px offset (`:focus-visible`).
- Contrast ratio strictly exceeds WCAG AA standards (4.5:1 for body text).
