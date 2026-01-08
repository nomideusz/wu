# Wales and West Utilities Design System Documentation

## Overview

The Wales and West Utilities application uses a modern, cohesive design system built with CSS custom properties (CSS variables) and reusable components. This document outlines the design principles, components, and best practices.

## Core Design Principles

1. **Dark Theme First**: Optimized for reduced eye strain during extended use
2. **Consistency**: Unified spacing, colors, and typography across all pages
3. **Responsiveness**: Mobile-first approach with breakpoints at 480px, 768px, and 1200px
4. **Accessibility**: High contrast ratios and proper ARIA labels
5. **Performance**: CSS-based animations and minimal JavaScript for interactions

## Color System

### Theme Variables

```css
/* Main colors */
--bg-primary: #0f0f14;      /* Main background */
--bg-secondary: #16161f;    /* Cards and sections */
--bg-tertiary: #1a1a26;     /* Nested elements */
--bg-card: #1e1e2a;         /* Card backgrounds */

/* Text colors */
--text-primary: #f7f7f8;    /* Main text */
--text-secondary: #a8a8b3;  /* Secondary text */

/* Accent colors */
--accent-primary: #3b82f6;  /* Primary blue */
--accent-secondary: #60a5fa; /* Light blue */
--accent-hover: #2563eb;    /* Hover state */

/* Status colors */
--error: #ef4444;           /* Error/danger */
--success: #10b981;         /* Success */
--warning: #f59e0b;         /* Warning */
--info: #06b6d4;            /* Info */
```

## PageTemplate Component

The `PageTemplate` component provides a consistent layout structure for all pages.

### Props

```typescript
interface PageTemplateProps {
  title?: string;           // Page title
  subtitle?: string;        // Optional subtitle
  description?: string;     // Page description
  showHeader?: boolean;     // Show/hide header (default: true)
  showActions?: boolean;    // Show/hide actions area (default: true)
  fullWidth?: boolean;      // Full width layout (default: false)
  noPadding?: boolean;      // Remove content padding (default: false)
  pageActions?: Snippet;    // Custom actions snippet
  headerContent?: Snippet;  // Additional header content
  content?: Snippet;        // Main content
  footer?: Snippet;         // Footer content
  children?: Snippet;       // Alternative to content
}
```

### Basic Usage

```svelte
<script>
  import PageTemplate from '$lib/components/PageTemplate.svelte';
</script>

<PageTemplate title="Page Title" description="Page description">
  {#snippet content()}
    <div>Your page content here</div>
  {/snippet}
</PageTemplate>
```

### Advanced Usage with Actions

```svelte
<PageTemplate 
  title="Reports"
  description="View and manage all reports"
>
  {#snippet pageActions()}
    <button class="button button--primary">
      <Plus size={18} />
      New Report
    </button>
    <div class="page-stats">
      <span class="page-stats__item page-stats__item--success">
        Final: 25
      </span>
      <span class="page-stats__item">
        Total: 30
      </span>
    </div>
  {/snippet}
  
  {#snippet content()}
    <div class="reports-table">
      <!-- Table content -->
    </div>
  {/snippet}
</PageTemplate>
```

## Button System

### Button Variants

```html
<!-- Primary button -->
<button class="button button--primary">Primary Action</button>

<!-- Secondary button -->
<button class="button button--secondary">Secondary Action</button>

<!-- Ghost button -->
<button class="button button--ghost">Ghost Action</button>

<!-- Danger button -->
<button class="button button--danger">Delete</button>

<!-- Success button -->
<button class="button button--success">Confirm</button>
```

### Button Sizes

```html
<!-- Small -->
<button class="button button--small">Small</button>

<!-- Default -->
<button class="button">Default</button>

<!-- Large -->
<button class="button button--large">Large</button>

<!-- Full width -->
<button class="button button--full">Full Width</button>
```

### Button States

```html
<!-- Loading state -->
<button class="button button--primary button--loading">Loading</button>

<!-- Disabled state -->
<button class="button button--primary" disabled>Disabled</button>

<!-- Icon only -->
<button class="button button--icon-only">
  <Settings size={20} />
</button>
```

### Button Groups

```html
<!-- Normal group -->
<div class="button-group">
  <button class="button button--primary">Save</button>
  <button class="button button--secondary">Cancel</button>
</div>

<!-- Attached group -->
<div class="button-group button-group--attached">
  <button class="button button--secondary">Left</button>
  <button class="button button--secondary">Center</button>
  <button class="button button--secondary">Right</button>
</div>
```

## Card Components

### Basic Card

```html
<div class="card">
  <div class="card__header">
    <h3 class="card__title">Card Title</h3>
  </div>
  <div class="card__content">
    <p>Card content goes here</p>
  </div>
</div>
```

### Metric Card

```html
<div class="metric-card">
  <div class="metric-card__header">
    <div class="metric-card__icon metric-card__icon--primary">
      <TrendingUp size={24} />
    </div>
    <span class="metric-card__label">Total Distance</span>
  </div>
  <div class="metric-card__value">
    1,234.56 <span class="metric-card__unit">km</span>
  </div>
  <div class="metric-card__footer">
    <div class="metric-card__stat">
      <Activity size={14} />
      <span>150 indications</span>
    </div>
  </div>
</div>
```

## Table Styles

### Responsive Table

```html
<div class="table-container">
  <table class="table">
    <thead>
      <tr>
        <th class="table__header">Name</th>
        <th class="table__header table__header--sortable" onclick={handleSort}>
          Date
          <span class="table__sort-icon">↓</span>
        </th>
        <th class="table__header table__header--status">Status</th>
      </tr>
    </thead>
    <tbody>
      <tr class="table__row">
        <td class="table__cell">Report Name</td>
        <td class="table__cell">2024-01-15</td>
        <td class="table__cell table__cell--status">
          <span class="status status--success">Final</span>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

## Status Badges

```html
<!-- Success -->
<span class="status-badge status-badge--success">Active</span>

<!-- Warning -->
<span class="status-badge status-badge--warning">Pending</span>

<!-- Error -->
<span class="status-badge status-badge--error">Failed</span>

<!-- Info -->
<span class="status-badge status-badge--info">Info</span>
```

## Loading States

### Skeleton Loading

```html
<!-- Text skeleton -->
<div class="skeleton-text"></div>

<!-- Large text skeleton -->
<div class="skeleton-text skeleton-text--large"></div>

<!-- Badge skeleton -->
<div class="skeleton-text skeleton-text--badge"></div>
```

### Loading Indicator

```html
<div class="loading-container">
  <div class="loading-indicator">
    <div class="loading-bar"></div>
    <div class="loading-bar"></div>
    <div class="loading-bar"></div>
  </div>
  <p class="loading-text">Loading data...</p>
</div>
```

## Responsive Design

### Breakpoints

- **Mobile**: < 480px
- **Tablet**: 480px - 768px
- **Desktop**: 768px - 1200px
- **Large Desktop**: > 1200px

### Example Responsive Component

```css
.dashboard__metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

@media (max-width: 1200px) {
  .dashboard__metrics {
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  }
}

@media (max-width: 768px) {
  .dashboard__metrics {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
```

## Navigation

The collapsible sidebar navigation persists its state in localStorage.

### Navigation Structure

```svelte
<nav class="nav {isNavCollapsed ? 'nav--collapsed' : ''}">
  <div class="nav__header">
    <button class="nav__toggle" onclick={toggleNav}>
      {#if isNavCollapsed}
        <ChevronRight size={20} />
      {:else}
        <ChevronLeft size={20} />
      {/if}
    </button>
  </div>
  
  <div class="nav__content">
    <ul class="nav__list">
      <li class="nav__item">
        <a href="/dashboard" class="nav__link nav__link--active">
          <LayoutDashboard size={20} />
          <span class="nav__text">Dashboard</span>
        </a>
      </li>
    </ul>
  </div>
</nav>
```

## Best Practices

### 1. Use Semantic HTML

```html
<!-- Good -->
<nav class="nav">...</nav>
<main class="main">...</main>
<article class="card">...</article>

<!-- Avoid -->
<div class="nav">...</div>
<div class="main">...</div>
<div class="card">...</div>
```

### 2. Follow BEM Naming Convention

```css
/* Block */
.card {}

/* Element */
.card__header {}
.card__title {}

/* Modifier */
.card--highlighted {}
.card__title--large {}
```

### 3. Use CSS Variables for Theming

```css
/* Good */
.card {
  background-color: var(--bg-card);
  color: var(--text-primary);
}

/* Avoid */
.card {
  background-color: #1e1e2a;
  color: #f7f7f8;
}
```

### 4. Implement Loading States

Always show loading states for async operations:

```svelte
{#if loading}
  <div class="skeleton-text"></div>
{:else}
  <div>{data}</div>
{/if}
```

### 5. Handle Empty States

```svelte
{#if items.length === 0}
  <div class="empty-state">
    <p>No items found</p>
  </div>
{:else}
  <!-- Show items -->
{/if}
```

### 6. Accessibility

- Use proper heading hierarchy (h1, h2, h3, etc.)
- Add ARIA labels where needed
- Ensure sufficient color contrast
- Make interactive elements keyboard accessible

## File Structure

```
src/lib/styles/
├── theme.css         # CSS variables and global theme
├── layout.css        # Layout components
├── buttons.css       # Button styles
├── cards.css         # Card components
├── tables.css        # Table styles
├── forms.css         # Form elements
├── navigation.css    # Navigation styles
├── dashboard.css     # Dashboard-specific styles
└── settings.css      # Settings page styles
```

## Icons

The application uses [Lucide Icons](https://lucide.dev/) for consistent iconography:

```svelte
<script>
  import { User, Settings, LogOut } from 'lucide-svelte/icons';
</script>

<User size={20} />
<Settings size={18} strokeWidth={2} />
<LogOut size={16} class="custom-class" />
```

## Animation Guidelines

Use CSS transitions for smooth interactions:

```css
.element {
  transition: all var(--transition-normal) cubic-bezier(0.4, 0, 0.2, 1);
}

/* Available transition speeds */
--transition-fast: 0.15s;
--transition-normal: 0.25s;
--transition-slow: 0.5s;
```

## Example Page Implementation

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import PageTemplate from '$lib/components/PageTemplate.svelte';
  import { Plus, Download } from 'lucide-svelte/icons';
  
  let data = $state([]);
  let loading = $state(true);
  
  onMount(async () => {
    try {
      const response = await fetch('/api/data');
      data = await response.json();
    } finally {
      loading = false;
    }
  });
</script>

<PageTemplate 
  title="Data Management"
  description="View and manage your data"
>
  {#snippet pageActions()}
    <button class="button button--primary">
      <Plus size={18} />
      Add New
    </button>
    <button class="button button--secondary">
      <Download size={18} />
      Export
    </button>
  {/snippet}
  
  {#snippet content()}
    <div class="data-grid">
      {#if loading}
        <div class="loading-container">
          <div class="loading-indicator">
            <div class="loading-bar"></div>
            <div class="loading-bar"></div>
            <div class="loading-bar"></div>
          </div>
        </div>
      {:else if data.length === 0}
        <div class="empty-state">
          <p>No data found</p>
          <button class="button button--primary">Add your first item</button>
        </div>
      {:else}
        <div class="card-grid">
          {#each data as item}
            <div class="card">
              <h3 class="card__title">{item.name}</h3>
              <p class="card__content">{item.description}</p>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/snippet}
</PageTemplate>

<style>
  .data-grid {
    display: grid;
    gap: 1.5rem;
  }
  
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }
  
  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--text-secondary);
  }
</style> 