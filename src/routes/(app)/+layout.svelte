<script lang="ts">
	import '$lib/styles/typography.css';
	import '$lib/styles/theme.css';
	import '$lib/styles/layout.css';
	import '$lib/styles/navigation.css';
	import '$lib/styles/ui-components.css';
	import '$lib/styles/buttons.css';
	import '$lib/styles/cards.css';
	import '$lib/styles/tables.css';
	import Flame from 'lucide-svelte/icons/flame';
	import LayoutDashboard from 'lucide-svelte/icons/layout-dashboard';
	import FileText from 'lucide-svelte/icons/file-text';
	import Settings from 'lucide-svelte/icons/settings';
	import ChartBar from 'lucide-svelte/icons/chart-bar';
	import Eye from 'lucide-svelte/icons/eye';
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	import ChevronRight from 'lucide-svelte/icons/chevron-right';
	import Menu from 'lucide-svelte/icons/menu';
	import X from 'lucide-svelte/icons/x';
	import Loader from 'lucide-svelte/icons/loader';
	import { language, t } from '$lib';
	import { initialUserValue, setupAuthListener, pb } from '$lib/pocketbase';
	import { onDestroy, onMount } from 'svelte';
	import { languageContext, languageStore, navigationContext, navigationStore } from '$lib/context';
	import { authFSM, updateAuthState, authContext, authStore } from '$lib/auth';
	import { IsMounted } from 'runed';
	import AuthStatus from './AuthStatus.svelte';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { APP_VERSION } from '$lib/version';
	
	interface LayoutData {
		user: any;
		isAuthenticated: boolean;
		isAdmin: boolean;
	}
	
	let { children, data } = $props<{data: LayoutData}>();
	
	// Use IsMounted from Runed
	const isMounted = new IsMounted();
	
	// Navigation collapsed state - persist in localStorage
	let isNavCollapsed = $state(false);
	
	// Mobile navigation state
	let isMobileNavOpen = $state(false);
	
	// Load collapsed state from localStorage on mount
	$effect(() => {
		if (isMounted.current && typeof window !== 'undefined') {
			const saved = localStorage.getItem('navCollapsed');
			isNavCollapsed = saved === 'true';
		}
	});
	
	// Save collapsed state to localStorage when it changes
	$effect(() => {
		if (isMounted.current && typeof window !== 'undefined') {
			localStorage.setItem('navCollapsed', String(isNavCollapsed));
		}
	});
	
	// Toggle navigation collapsed state (desktop)
	function toggleNavigation() {
		isNavCollapsed = !isNavCollapsed;
	}
	
	// Toggle mobile navigation
	function toggleMobileNav() {
		isMobileNavOpen = !isMobileNavOpen;
	}
	
	// Close mobile nav when clicking a link
	function closeMobileNav() {
		isMobileNavOpen = false;
	}
	
	// Close mobile nav on escape key
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isMobileNavOpen) {
			isMobileNavOpen = false;
		}
	}
	
	// Initialize auth store with initial values as early as possible
	authStore.set({
		isAuthenticated: !!data.user,
		user: data.user || null,
		state: data.user ? 'loggedIn' : 'loggedOut'
	});
	
	// Initialize context with the store - this should only happen once during initialization
	authContext.set(authStore);
	
	// Track logout loading state
	let isLoggingOut = $state(false);
	
	// Minimum loading time for animations
	const MIN_LOADING_TIME = 800;
	
	// Form reference for programmatic submission
	let logoutForm = $state<HTMLFormElement | null>(null);
	
	// Create a state for the current user
	let currentUser = $state(initialUserValue || data.user || null);
	
	// Create an explicitly typed variable for clarity in comparisons
	type AuthState = 'loggedOut' | 'loggedIn' | 'loading' | 'loggingIn' | 'loggingOut';
	
	// Track auth state separately to ensure UI consistency
	let authState = $state<AuthState>(authFSM.current);
	
	// Helper function for type-safe auth state comparison
	function isAuthState(state: AuthState, compare: AuthState): boolean {
		return state === compare;
	}
	
	// Update currentUser with data from server
	$effect(() => {
		if (data.user) {
			console.log('User data from server:', data.user);
			currentUser = data.user;
			updateAuthState(data.user);
		}
	});
	
	// For debugging - use proper state snapshot for state values
	$effect(() => {
		// Create a snapshot of the state for logging
		const currentUserSnapshot = $state.snapshot(currentUser);
		
		console.log('Auth state:', authFSM.current);
		console.log('Current user from state:', currentUserSnapshot);
		console.log('User from props data:', data.user);
		console.log('Component mounted:', isMounted.current);
		console.log('Is authenticated (server):', data.isAuthenticated);
		
		// Make sure we update FSM if props data shows authentication
		if (data.isAuthenticated && authState !== 'loggedIn') {
			console.log('Props data shows authenticated but FSM disagrees - fixing');
			updateAuthState({ exists: true, forceAuth: true });
		}
	});
	
	// Watch for auth state changes
	$effect(() => {
		authState = authFSM.current;
		console.log('Auth state updated:', authState);
		
		// Force update to ensure UI reflects current auth state
		if (data.isAuthenticated && authState !== 'loggedIn') {
			console.log('Auth mismatch - Server says authenticated but FSM says:', authState);
			// Update FSM if server indicates user is authenticated - use force flag
			updateAuthState({ exists: true, forceAuth: true });
		}
		
		// Update auth store whenever auth state or user changes
		authStore.update(() => ({
			isAuthenticated: data.isAuthenticated || authState === 'loggedIn',
			user: currentUser,
			state: authState
		}));
	});
	
	// Set component as mounted and immediately sync auth state
	onMount(() => {
		// Force auth state check on mount with stronger enforcement
		console.log('Component mounted, checking auth state; Server says authenticated:', data.isAuthenticated);
		
		// Set the currentUser state from server data if available
		if (data.user) {
			console.log('Setting currentUser from server data:', data.user.email);
			currentUser = data.user;
		}
		
		// Immediately set the FSM state based on server authentication
		if (data.isAuthenticated) {
			console.log('Setting FSM to match server authenticated state');
			// Only update if necessary - avoid transitions if already in the right state
			if (authFSM.current !== 'loggedIn') {
				if (authFSM.current === 'loggingIn') {
					// If we're already transitioning, just speed it up
					authFSM.send('finishTransition');
				} else {
					// Otherwise, start the login process
					updateAuthState({ exists: true, forceAuth: true });
				}
			}
			// Double-check the transition happened
			console.log('FSM state after server auth sync:', authFSM.current);
		} else if (data.isAuthenticated === false) {
			// Explicitly set to logged out if server says not authenticated
			console.log('Server says not authenticated, ensuring logged out state');
			if (authFSM.current !== 'loggedOut' && authFSM.current !== 'loggingOut') {
				authFSM.send('logout');
			}
		}
	});
	
	// Set up auth listener to update currentUser
	const cleanup = setupAuthListener((user) => {
		console.log('Auth listener triggered with user:', user ? 'User exists' : 'No user');
		currentUser = user;
		// Update FSM state manually when currentUser changes
		updateAuthState(user);
	});
	
	// Clean up listener on component destruction
	onDestroy(cleanup);
	
	// Get current year for the footer
	const currentYear = new Date().getFullYear();
	
	// Set language context from the store
	languageContext.set(languageStore);
	

	
	// Initialize auth FSM on component mount
	onDestroy(() => {
		console.log('Component cleanup');
	});
	
	// Function to handle logout with loading state
	async function handleLogout(event: Event) {
		// Prevent default form submission
		event.preventDefault();
		
		// Don't trigger twice
		if (isLoggingOut) return;
		
		// Set loading state immediately for UI change
		isLoggingOut = true;
		
		// Log for debugging
		console.log('Logging out... Animation starting.');
		
		// Set FSM state to loggingOut immediately 
		authFSM.send('logout');
		
		// Ensure the UI has time to update before the animation
		await new Promise(resolve => setTimeout(resolve, 20));
		
		// Wait for the minimum animation time before submitting the form
		// Use longer time for visibility
		const ANIMATION_DISPLAY_TIME = 1200;
		
		await new Promise(resolve => {
			setTimeout(() => {
				console.log(`Logout animation shown for ${ANIMATION_DISPLAY_TIME}ms, proceeding with logout`);
				
				// Manually submit the form after the animation has shown
				if (logoutForm) {
					logoutForm.submit();
				} else {
					console.error('Logout form not found');
				}
				
				resolve(null);
			}, ANIMATION_DISPLAY_TIME);
		});
	}
	
	// Set up navigation context
	navigationContext.set(navigationStore);
	
	// Loading delay timer reference
	let loadingTimer: ReturnType<typeof setTimeout> | null = null;
	// Flag to track if this is the initial page load
	let isInitialLoad = true;
	
	// Track navigation changes with loading state
	beforeNavigate(({ from, to, type }) => {
		// Skip showing loader on initial page load to allow skeleton UI to show first
		if (isInitialLoad) {
			isInitialLoad = false;
			return;
		}
		
		// Only show loader for slow full-page navigations, not for:
		// - Hash changes (anchors)
		// - Search param changes
		// - Same-route data reloads
		const isFullNavigation = from && to && 
			from.url.pathname !== to.url.pathname;
		
		if (isFullNavigation) {
			// Set navigating state immediately
			navigationStore.update(state => ({ ...state, isNavigating: true }));
			
			// Set a timer to show loader only if navigation takes longer than 400ms
			loadingTimer = setTimeout(() => {
				navigationStore.update(state => ({ ...state, shouldShowLoader: true }));
			}, 400); // Slightly increased delay for skeleton UI to take precedence
		}
	});
	
	afterNavigate(({ to }) => {
		// Clear the timer if navigation completes quickly
		if (loadingTimer) {
			clearTimeout(loadingTimer);
			loadingTimer = null;
		}
		
		// Update pathname and reset loading states
		if (to?.url) {
			navigationStore.set({ 
				pathname: to.url.pathname,
				isNavigating: false,
				shouldShowLoader: false
			});
		}
		
		// Close mobile nav on route change
		isMobileNavOpen = false;
	});
	
	// Function to check if a given path is active using navigation context
	function isActive(path: string, exact = false): boolean {
		// Get current pathname from navigation store
		const currentPathname = $navigationStore.pathname;
		
		if (exact) {
			return currentPathname === path;
		}
		
		// For nested routes, check if pathname starts with the path
		// But ensure we don't treat /reports as active when on /report-details
		return currentPathname === path || 
			(currentPathname.startsWith(path) && path !== '/' && 
			(currentPathname.charAt(path.length) === '/' || currentPathname.length === path.length));
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- Render children directly -->
{#snippet defaultContent()}
<div class="layout" data-sveltekit-layout="root">
	{#if authState === 'loggingOut'}
		<div class="fullscreen-loading">
			<div class="loading-indicator">
				<Loader size={36} class="loading-icon" />
				<p class="loading-text">{t('layout.loggingOut', $language)}</p>
			</div>
		</div>
	{/if}

	<!-- Mobile navigation overlay -->
	{#if isMobileNavOpen}
		<div class="mobile-nav-overlay" onclick={closeMobileNav}>
			<nav class="mobile-nav" onclick={(e) => e.stopPropagation()}>
				<div class="mobile-nav__header">
					<div class="mobile-nav__brand">
						<div class="header__logo">
							<Flame size={18} />
						</div>
						<span class="header__brand-name">{t('appName', $language)}</span>
					</div>
					<button class="mobile-nav__close" onclick={closeMobileNav} aria-label="Close navigation">
						<X size={24} />
					</button>
				</div>
				
				<div class="mobile-nav__content">
					<div class="mobile-nav__section">
						<h3 class="mobile-nav__heading">{t('nav.main', $language)}</h3>
						<ul class="mobile-nav__list">
							<li class="mobile-nav__item">
								<a href="/" class="mobile-nav__link" class:mobile-nav__link--active={isActive('/', true)} onclick={closeMobileNav}>
									<LayoutDashboard size={20} class="mobile-nav__icon" />
									<span class="mobile-nav__text">{t('nav.dashboard', $language)}</span>
								</a>
							</li>
							<li class="mobile-nav__item">
								<a href="/reports" class="mobile-nav__link" class:mobile-nav__link--active={isActive('/reports')} onclick={closeMobileNav}>
									<FileText size={20} class="mobile-nav__icon" />
									<span class="mobile-nav__text">{t('nav.reports', $language)}</span>
								</a>
							</li>
							<li class="mobile-nav__item">
								<a href="/settings" class="mobile-nav__link" class:mobile-nav__link--active={isActive('/settings')} onclick={closeMobileNav}>
									<Settings size={20} class="mobile-nav__icon" />
									<span class="mobile-nav__text">{t('nav.settings', $language)}</span>
								</a>
							</li>
						</ul>
					</div>
					
					{#if data.isAuthenticated}
					<div class="mobile-nav__section">
						<h3 class="mobile-nav__heading">{t('nav.tools', $language)}</h3>
						<ul class="mobile-nav__list">
							<li class="mobile-nav__item">
								<a href="/priority-score-analyzer" class="mobile-nav__link" class:mobile-nav__link--active={isActive('/priority-score-analyzer')} onclick={closeMobileNav}>
									<ChartBar size={20} class="mobile-nav__icon" />
									<span class="mobile-nav__text">PS 2.0 Analyzer</span>
								</a>
							</li>
							{#if data.isAdmin}
								<li class="mobile-nav__item">
									<a href="/survey-viewer" class="mobile-nav__link" class:mobile-nav__link--active={isActive('/survey-viewer')} onclick={closeMobileNav}>
										<Eye size={20} class="mobile-nav__icon" />
										<span class="mobile-nav__text">{t('tools.surveyViewer', $language)}</span>
									</a>
								</li>
							{/if}
						</ul>
					</div>
					{/if}
				</div>
			</nav>
		</div>
	{/if}

	<!-- Ensure the auth context is properly provided to all children -->
	<header class="header">
		<!-- Mobile menu button -->
		<button class="header__mobile-menu" onclick={toggleMobileNav} aria-label="Toggle navigation">
			<Menu size={20} />
		</button>
		
		<!-- Logo/Brand -->
		<a href="/" class="header__brand" title="Wales and West Utilities">
			<div class="header__logo">
				<Flame size={18} />
			</div>
			<div class="header__brand-text">
				<span class="header__brand-name">{t('appName', $language)}</span>
				<span class="header__brand-description">{t('appDescription', $language)}</span>
			</div>
		</a>
		
		<div class="header__controls">
			<!-- Login button or logout button based on auth state -->
			<div class="header__login-area">
				{#if !isMounted.current}
					<div class="header__loading">{t('auth.loading', $language)}</div>
				{:else}
					<div class="auth-section">
						<!-- Fix login button checks -->
						{#if data.isAuthenticated}
							<div class="auth__user-info">
								<span class="auth__welcome-text">{currentUser?.username || currentUser?.email || 'User'}</span>
								<form action="/logout" method="POST" bind:this={logoutForm} onsubmit={handleLogout}>
									<button type="submit" class="button button--logout" disabled={isLoggingOut}>
										{#if isLoggingOut}
											<span class="button__spinner"><Loader size={14} /></span>
											<span>{t('auth.loggingOut', $language)}</span>
										{:else}
											<span>{t('auth.logout', $language)}</span>
										{/if}
									</button>
								</form>
							</div>
						{:else if isAuthState(authState, 'loggingIn') || isAuthState(authState, 'loading')}
							<span class="auth__state-indicator">
								<span class="button__spinner"><Loader size={14} /></span>
								{t('auth.loading', $language)}
							</span>
						{:else}
							<a href="/login" class="button button--login">{t('auth.login', $language)}</a>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</header>

	<div class="layout__content">
		<!-- Navigation sidebar -->
		<nav class="nav" class:nav--collapsed={isNavCollapsed}>
			<div class="nav__header">
				<!-- Navigation toggle button -->
				<button 
					class="nav__toggle" 
					onclick={toggleNavigation}
					title={isNavCollapsed ? t('nav.expand', $language) : t('nav.collapse', $language)}
					aria-label={isNavCollapsed ? t('nav.expand', $language) : t('nav.collapse', $language)}
				>
					{#if isNavCollapsed}
						<ChevronRight size={20} />
					{:else}
						<ChevronLeft size={20} />
					{/if}
				</button>
			</div>
			
			<div class="nav__content">
			<div class="nav__section">
				{#if !isNavCollapsed}
				<h3 class="nav__heading">{t('nav.main', $language)}</h3>
				{/if}
				<ul class="nav__list">
					<li class="nav__item" class:nav__item--active={isActive('/', true)}>
						<a href="/" class="nav__link" title="{t('nav.dashboard', $language)}">
							<LayoutDashboard size={20} class="nav__icon" />
							{#if !isNavCollapsed}
							<span class="nav__text">{t('nav.dashboard', $language)}</span>
							{/if}
						</a>
					</li>
					<li class="nav__item" class:nav__item--active={isActive('/reports')}>
						<a href="/reports" class="nav__link" title="{t('nav.reports', $language)}">
							<FileText size={20} class="nav__icon" />
							{#if !isNavCollapsed}
							<span class="nav__text">{t('nav.reports', $language)}</span>
							{/if}
						</a>
					</li>
					<li class="nav__item" class:nav__item--active={isActive('/settings')}>
						<a href="/settings" class="nav__link" title="{t('nav.settings', $language)}">
							<Settings size={20} class="nav__icon" />
							{#if !isNavCollapsed}
							<span class="nav__text">{t('nav.settings', $language)}</span>
							{/if}
						</a>
					</li>
				</ul>
			</div>
			
			{#if data.isAuthenticated}
			<div class="nav__section">
				{#if !isNavCollapsed}
				<h3 class="nav__heading">{t('nav.tools', $language)}</h3>
				{/if}
				<ul class="nav__list">
					<li class="nav__item" class:nav__item--active={isActive('/priority-score-analyzer')}>
						<a href="/priority-score-analyzer" class="nav__link" title="Priority Score Analyzer">
							<ChartBar size={20} class="nav__icon" />
							{#if !isNavCollapsed}
							<span class="nav__text">PS 2.0 Analyzer</span>
							{/if}
						</a>
					</li>
					{#if data.isAdmin}
						<li class="nav__item" class:nav__item--active={isActive('/survey-viewer')}>
							<a href="/survey-viewer" class="nav__link" title="{t('tools.surveyViewer', $language)}">
								<Eye size={20} class="nav__icon" />
								{#if !isNavCollapsed}
								<span class="nav__text">{t('tools.surveyViewer', $language)}</span>
								{/if}
							</a>
						</li>
					{/if}
				</ul>
			</div>
			{/if}
			</div>
		</nav>

		<!-- Main content area -->
		<main class="main">
			{@render children()}
		</main>

		{#if $navigationStore.shouldShowLoader}
			<div class="navigation-loader navigation-loader--minimal">
				<div class="navigation-loader__spinner">
					<Loader size={18} />
					<span class="navigation-loader__text">{t('loading.pageLoading', $language)}</span>
				</div>
			</div>
		{/if}
	</div>

	<footer class="footer">
		<div class="footer__content">
			<p class="footer__text">{t('footer.copyright', $language).replace('{year}', String(currentYear))}</p>
			<p class="footer__text">{t('footer.version', $language)} {APP_VERSION}</p>
		</div>
	</footer>
</div>
{/snippet}

{@render defaultContent()}