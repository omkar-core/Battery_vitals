# Battery Vital — UI/UX Design System (DESIGN.md)

## 1. Design Philosophy & Industrial Ergonomics

Battery Vital is engineered with an **Industrial Telemetry Ergonomics** philosophy. The user interface is optimized for energy storage engineers, EV fleet operators, and facility technicians who need immediate, unambiguous situational awareness.

### Core Principles
1. **Instant Legibility at a Glance**: The primary safety status, pack voltage, cell temperature, and gas concentration must be decipherable from across a workbench or control room within 200 milliseconds.
2. **Tabular Metric Stability**: Telemetry values stream at 1.5-second intervals. Monospace numerical styling (`tabular-nums`) prevents UI jitter or layout shifts as decimal numbers fluctuate.
3. **High-Contrast Obsidian Glassmorphism**: High-contrast dark mode prevents eye fatigue in dark battery enclosures or dimly lit command centers while reducing OLED display power consumption on field tablets.
4. **Physicality in Remote Controls**: Actuator toggles on the web control panel visually mirror physical switches, providing real-time state feedback reflecting the actual GPIO pin status reported by the ESP32.

---

## 2. Color System & Design Tokens

### 2.1 Color Palette

```
┌───────────────────────────────────────────────────────────────────────────┐
│                               Base Canvas Tokens                          │
│   #070a0f          #0d131f          #131c2e          #1e293b              │
│  Canvas Deep     Card Surface     Card Raised      Border Accent          │
└───────────────────────────────────────────────────────────────────────────┘
┌───────────────────────────────────────────────────────────────────────────┐
│                             Semantic Status Tokens                        │
│   #10b981          #f59e0b          #ef4444          #8b5cf6              │
│  Safe/Normal    Caution/Warning  Critical/Emergency  AI Intelligence      │
└───────────────────────────────────────────────────────────────────────────┘
```

| Token Name | Hex Value | RGBA Tint / Glow | Usage / Context |
|---|---|---|---|
| `--color-canvas` | `#070a0f` | `rgb(7, 10, 15)` | Primary page background |
| `--color-surface` | `#0d131f` | `rgba(13, 19, 31, 0.8)` | Metric cards, telemetry containers |
| `--color-surface-raised`| `#131c2e` | `rgba(19, 28, 46, 0.9)` | Hover states, modals, floating panels |
| `--color-border` | `#1e293b` | `rgba(255, 255, 255, 0.08)`| Subtle 1px card borders |
| `--color-safe` | `#10b981` | `rgba(16, 185, 129, 0.15)` | Normal battery operation, nominal temp, green LED |
| `--color-warning` | `#f59e0b` | `rgba(245, 158, 11, 0.15)` | Elevated temp (38–45°C), low SOC (<15%), yellow LED |
| `--color-critical`| `#ef4444` | `rgba(239, 68, 68, 0.20)` | Hazard trips, runaway risk (>45°C), red LED, buzzer |
| `--color-telemetry`| `#06b6d4` | `rgba(6, 182, 212, 0.15)` | Bus voltage, electrical power, INA219 metrics |
| `--color-ai` | `#8b5cf6` | `rgba(139, 92, 246, 0.18)`| Gemini diagnostic insights, prediction curves |
| `--text-primary` | `#f8fafc` | `rgb(248, 250, 252)` | Main telemetry numbers, headings |
| `--text-secondary`| `#94a3b8` | `rgb(148, 163, 184)` | Labels, metric units, subtitles |
| `--text-muted` | `#64748b` | `rgb(100, 116, 139)` | Timestamps, inactive indicators |

### 2.2 Glassmorphism & Elevation Tokens
```css
/* Custom CSS Glassmorphic Utility Classes */
.card-glass {
  background: rgba(13, 19, 31, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.5);
  border-radius: 12px;
}

.card-glass-glow-safe {
  border-color: rgba(16, 185, 129, 0.4);
  box-shadow: 0 0 15px -3px rgba(16, 185, 129, 0.25);
}

.card-glass-glow-critical {
  border-color: rgba(239, 68, 68, 0.5);
  box-shadow: 0 0 20px -2px rgba(239, 68, 68, 0.35);
}
```

---

## 3. Typography System

### 3.1 Font Families
- **Primary Interface Font**: Inter / System UI (`font-sans`): Clean, geometric sans-serif for headers, navigation, tooltips, and AI diagnostic narratives.
- **Telemetry Numerics Font**: Monospace (`ui-monospace`, `SFMono-Regular`, `Menlo`, `Roboto Mono`):
  - Applied to all live voltage, current, power, temperature, and timestamp values.
  - Coupled with CSS `font-variant-numeric: tabular-nums` to ensure zero horizontal jitter during continuous real-time updates.

### 3.2 Type Scale Hierarchy

| Element | Size | Weight | Line Height | Tracking | Font Family |
|---|---|---|---|---|---|
| **Display Telemetry** | 36px / 2.25rem | Bold (700) | 1.1 | -0.02em | Monospace |
| **Section Heading (H1)** | 28px / 1.75rem | SemiBold (600) | 1.2 | -0.01em | Sans-Serif |
| **Card Heading (H2)** | 18px / 1.125rem | Medium (500) | 1.3 | Normal | Sans-Serif |
| **Metric Label** | 12px / 0.75rem | Medium (500) | 1.4 | +0.05em (Uppercase)| Sans-Serif |
| **Unit Suffix** | 16px / 1.0rem | Regular (400) | 1.0 | Normal | Monospace |
| **AI Narrative Body** | 14px / 0.875rem | Regular (400) | 1.6 | Normal | Sans-Serif |

---

## 4. Component Design Specifications

### 4.1 Metric Card (`MetricCard.jsx`)
```
┌─────────────────────────────────────────────────────────┐
│ VOLTAGE (BUS)                              🟢 NOMINAL   │
│                                                         │
│  12.64 V                ▲ +0.02V (1.5s)                │
│                                                         │
│ ───────────────[ Live Sparkline ]────────────────────── │
│ Min: 12.58V                     Max: 12.68V             │
└─────────────────────────────────────────────────────────┘
```
- **Header**: Metric label in uppercase slate text with an inline status chip indicating nominal, warning, or trip state.
- **Value Area**: Large tabular monospace readout with clear unit indicator.
- **Delta Indicator**: Sub-second trend arrow (▲/▼) showing derivative change over the last sampling frame.
- **Sparkline**: Micro SVG trendline displaying the previous 20 rolling samples.

### 4.2 Radial Gauges (`GaugeChart.jsx`)
- Used for **SOC (State of Charge)** (0–100%) and **AQI (Air Quality Index)** (0–500).
- **Visual Design**: 240-degree circular SVG track with smoothed gradient stroke.
  - Safe zone: Emerald (#10b981).
  - Caution zone: Amber (#f59e0b).
  - Hazard zone: Rose (#ef4444).
- Center text displays dynamic integer percentage with a secondary estimated runtime countdown.

### 4.3 Streaming Telemetry Charts (`LiveChart.jsx`)
- **Charting Library**: Recharts 2.10.3 with custom Obsidian theme wrappers.
- **Visual Stylings**:
  - Gradient Area Fill: Linear gradient fading from `rgba(6, 182, 212, 0.3)` at the curve to transparent at the baseline.
  - Grid Lines: Subtle horizontal dashed rules (`rgba(255, 255, 255, 0.05)`).
  - Crosshair Tooltip: Floating glass card displaying exact time, voltage, current, and temperature with color-matched dots.

### 4.4 Hardware Control Actuator Toggles (`ControlPanel.jsx`)
- **Interactive Switch**: Tactile toggle switch with simulated LED glow indicator.
- **State Feedback**:
  - Yellow outline while command is in-flight to Firebase.
  - Solid color upon confirmation from ESP32 (`/live_data/BAT001/hardware`).
  - Disabled state with tooltip if user role lacks `control_hardware` permission.

### 4.5 Global Emergency Alert Banner (`AlertBanner.jsx`)
- Appears anchored below the header when the deterministic safety engine enters `CRITICAL` or `EMERGENCY`.
- High-visibility pulsing red background with high-contrast white text.
- Includes quick-action button to inspect the root cause, mute browser audio chime, and view suggested Gemini remediations.

---

## 5. Responsive Grid & Breakpoints

```
Breakpoints:
  • Mobile:   < 768px       (Single-column vertical stack, slide-over drawer)
  • Tablet:   768px - 1023px (2-column layout, compact sidebar)
  • Desktop:  ≥ 1024px      (Fixed sidebar navigation, 3 or 4-column metric grid)
  • Ultrawide: ≥ 1536px     (Dedicated side-by-side live telemetry & AI diagnostic split)
```

### Layout Grid Blueprint (Desktop)
```
┌───────────┬─────────────────────────────────────────────────────────────┐
│           │ Header: Device BAT001 • Status: SAFE • Wi-Fi -62dBm • User  │
│           ├─────────────────────────────────────────────────────────────┤
│  Sidebar  │ Live Metric Grid:                                           │
│  Nav      │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│           │ │ Voltage Card │ │ Current Card │ │ Temp Card    │         │
│  • Live   │ └──────────────┘ └──────────────┘ └──────────────┘         │
│  • Battery│ ┌───────────────────────────────┐ ┌──────────────────────┐ │
│  • Env    │ │ Real-Time Telemetry Curve     │ │ SOC Radial Gauge     │ │
│  • Control│ │ (Recharts LiveChart)          │ │ (0-100% + Runtime)   │ │
│  • AI     │ └───────────────────────────────┘ └──────────────────────┘ │
│  • Alerts │ ┌────────────────────────────────────────────────────────┐ │
│  • History│ │ Gemini AI Real-Time Diagnostic Insights                │ │
│  • Users  │ └────────────────────────────────────────────────────────┘ │
└───────────┴─────────────────────────────────────────────────────────────┘
```

---

## 6. Accessibility (a11y) & Industrial Usability Standards

1. **Color Contrast Ratios**: All text against background meets or exceeds **WCAG 2.1 AA** standards (>4.5:1 for normal text, >3:1 for large numeric displays).
2. **Dual Status Encoding**: Color is never used as the sole indicator of state. Every alert and status badge couples color with an explicit text label (e.g., `CRITICAL`, `WARNING`, `SAFE`) and iconography.
3. **Auditory Alarm Inclusivity**:
   - Audio chimes for critical alerts can be toggled in settings.
   - Screen readers announce emergency alerts immediately via `aria-live="assertive"`.
4. **Touch Targets for Field Work**: All buttons, switches, and navigation tabs have minimum touch targets of **44 × 44 pixels** to accommodate gloved operation on industrial touchscreens.
