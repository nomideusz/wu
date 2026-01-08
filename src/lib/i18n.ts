import { writable, type Writable } from 'svelte/store';

// Define language type - now only English
export type Language = 'en';

// Define translation structure types - only English now
export interface Translations {
  en: TranslationContent;
}

export interface TranslationContent {
  appName: string;
  appDescription: string;
  nav: {
    main: string;
    dashboard: string;
    reports: string;
    users: string;
    settings: string;
    tools: string;
  };
  dashboard: {
    overview: string;
    welcomeMessage: string;
    totalReports: string;
    finalReports: string;
    draftReports: string;
    statistics: string;
    lastUpdated: string;
    totalDistance: string;
    car1Distance: string;
    car2Distance: string;
    distance: string;
    lisa: string;
    lisaPerKm: string;
    recentReports: string;
    viewAllReports: string;
    viewAll: string;
    lastSynced: string;
    syncUnavailable: string;
    loadingReports: string;
    reportName: string;
    reportTitle: string;
    date: string;
    assetsCovered: string;
    surveyorUnit: string;
    status: string;
    final: string;
    draft: string;
    noReportsFound: string;
    indications: string;
  };
  dataPanel: {
    dataDetails: string;
    id: string;
    product: string;
    sales: string;
    growth: string;
  };

  footer: {
    copyright: string;
    version: string;
  };
  auth: {
    login: string;
    logout: string;
    loggingOut: string;
    loading: string;
    title: string;
  };
  loading: {
    pageLoading: string;
  };
  tools: {
    surveyViewer: string;
  };
  loginPage: {
    title: string;
    email: string;
    emailPlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    loginButton: string;
    loggingIn: string;
    forgotPassword: string;
    pleaseWait: string;
    validation: {
      emailRequired: string;
      emailInvalid: string;
      passwordRequired: string;
    }
  };
  forgotPassword: {
    title: string;
    description: string;
    emailLabel: string;
    emailPlaceholder: string;
    sendButton: string;
    sending: string;
    backToLogin: string;
    pleaseWait: string;
    success: string;
    returnToLogin: string;
    validation: {
      emailRequired: string;
      emailInvalid: string;
    }
  };
  reports: {
    title: string;
    description: string;
    status: {
      final: string;
      draft: string;
      total: string;
    };
    table: {
      reportName: string;
      reportTitle: string;
      date: string;
      assetsCovered: string;
      surveyorUnit: string;
      lisa: string;
      status: string;
      noReportsFound: string;
    };
    loading: string;
    sync: {
      lastSynced: string;
      unavailable: string;
      never: string;
      unknown: string;
    };
    error: string;
  };
  logout: {
    redirecting: string;
    error: string;
  };
  resetPassword: {
    title: string;
    description: string;
    invalidToken: string;
    requestNewLink: string;
    success: string;
    goToLogin: string;
    newPassword: string;
    newPasswordPlaceholder: string;
    confirmPassword: string;
    confirmPasswordPlaceholder: string;
    passwordNote: string;
    setPasswordButton: string;
    settingPassword: string;
    backToLogin: string;
    pleaseWait: string;
    validation: {
      passwordRequired: string;
      passwordLength: string;
      confirmRequired: string;
      passwordsDoNotMatch: string;
    };
    error: string;
  };
  settings: {
    title: string;
    authRequired: string;
    login: string;
    profile: {
      title: string;
      username: string;
      email: string;
      emailNote: string;
      updateButton: string;
      updating: string;
      success: string;
      error: string;
    };
    password: {
      title: string;
      current: string;
      new: string;
      confirm: string;
      passwordNote: string;
      changeButton: string;
      changing: string;
      success: string;
      error: string;
      validationError: string;
    };
  };
}

// Translations for the application - only English now
export const translations: Translations = {
  en: {
    // Header
    appName: 'Wales and West Utilities',
    appDescription: 'Gas leak detection and monitoring system',
    
    // Navigation
    nav: {
      main: 'Main',
      dashboard: 'Dashboard',
      reports: 'Reports',
      users: 'Users',
      settings: 'Settings',
      tools: 'Tools'
    },
    
    // Dashboard
    dashboard: {
      overview: 'Dashboard Overview',
      welcomeMessage: "Statistics summary",
      totalReports: 'Total Reports',
      finalReports: 'Final Reports',
      draftReports: 'Draft Reports',
      statistics: 'Statistics',
      lastUpdated: 'Last updated',
      totalDistance: 'Total Distance',
      car1Distance: 'Vehicle #1',
      car2Distance: 'Vehicle #2',
      distance: 'Distance',
      lisa: 'LISA',
      lisaPerKm: 'LISA/km',
      recentReports: 'Recent Reports',
      viewAllReports: 'View All Reports',
      viewAll: 'View All',
      lastSynced: 'Last synced',
      syncUnavailable: 'Sync status unavailable',
      loadingReports: 'Loading recent reports...',
      reportName: 'Report Name',
      reportTitle: 'Report Title',
      date: 'Date',
      assetsCovered: 'Assets Covered',
      surveyorUnit: 'Surveyor Unit',
      status: 'Status',
      final: 'Final',
      draft: 'Draft',
      noReportsFound: 'No recent reports found',
      indications: 'LISA Indications',
    },
    
    // Data panel
    dataPanel: {
      dataDetails: 'Data Details',
      id: 'ID',
      product: 'Product',
      sales: 'Sales',
      growth: 'Growth'
    },
    
    // Footer
    footer: {
      copyright: '© {year} Wales and West Utilities',
      version: 'Version'
    },
    
    // Auth
    auth: {
      login: 'Login',
      logout: 'Logout',
      loggingOut: 'Logging out...',
      loading: 'Loading...',
      title: 'Wales and West Utilities'
    },
    
    // Loading
    loading: {
      pageLoading: 'Loading page...'
    },
    
    // Tools
    tools: {
      surveyViewer: 'Survey Viewer'
    },
    
    // Login Page
    loginPage: {
      title: 'Login',
      email: 'Email',
      emailPlaceholder: 'your@email.com',
      password: 'Password',
      passwordPlaceholder: 'Your password',
      loginButton: 'Login',
      loggingIn: 'Logging in...',
      forgotPassword: 'Forgot password?',
      pleaseWait: 'Please wait...',
      validation: {
        emailRequired: 'Email is required',
        emailInvalid: 'Please enter a valid email address',
        passwordRequired: 'Password is required'
      }
    },
    
    // Forgot Password Page
    forgotPassword: {
      title: 'Reset Your Password',
      description: 'Enter your email address, and we\'ll send you instructions to reset your password.',
      emailLabel: 'Email Address',
      emailPlaceholder: 'Enter your email address',
      sendButton: 'Send Reset Instructions',
      sending: 'Sending...',
      backToLogin: 'Back to Login',
      pleaseWait: 'Please wait...',
      success: 'Password reset instructions have been sent to your email.',
      returnToLogin: 'Return to Login',
      validation: {
        emailRequired: 'Email is required',
        emailInvalid: 'Please enter a valid email address'
      }
    },
    
    // Reports Page
    reports: {
      title: 'Reports',
      description: 'View all reports.',
      status: {
        final: 'Final',
        draft: 'Draft',
        total: 'Total'
      },
      table: {
        reportName: 'Report Name',
        reportTitle: 'Report Title',
        date: 'Date',
        assetsCovered: 'Assets Covered',
        surveyorUnit: 'Surveyor Unit',
        lisa: 'LISA',
        status: 'Status',
        noReportsFound: 'No reports found'
      },
      loading: 'Loading reports...',
      sync: {
        lastSynced: 'Last synced',
        unavailable: 'Sync status unavailable',
        never: 'Never',
        unknown: 'Unknown'
      },
      error: 'Failed to load reports'
    },
    
    // Logout
    logout: {
      redirecting: 'Redirecting...',
      error: 'Failed to logout'
    },
    
    // Reset Password
    resetPassword: {
      title: 'Set New Password',
      description: 'Please enter and confirm your new password.',
      invalidToken: 'Invalid or missing reset token. Please request a new password reset link.',
      requestNewLink: 'Request New Link',
      success: 'Your password has been successfully reset!',
      goToLogin: 'Go to Login',
      newPassword: 'New Password',
      newPasswordPlaceholder: 'Enter your new password',
      confirmPassword: 'Confirm Password',
      confirmPasswordPlaceholder: 'Confirm your new password',
      passwordNote: 'Must be at least 8 characters long.',
      setPasswordButton: 'Set New Password',
      settingPassword: 'Setting Password...',
      backToLogin: 'Back to Login',
      pleaseWait: 'Please wait...',
      validation: {
        passwordRequired: 'Password is required',
        passwordLength: 'Password must be at least 8 characters long',
        confirmRequired: 'Please confirm your password',
        passwordsDoNotMatch: 'Passwords do not match'
      },
      error: 'Failed to reset password'
    },
    
    // Settings
    settings: {
      title: 'Account Settings',
      authRequired: 'You must be logged in to access this page.',
      login: 'Login',
      profile: {
        title: 'Profile Information',
        username: 'Username',
        email: 'Email Address',
        emailNote: 'Email address cannot be changed.',
        updateButton: 'Update Profile',
        updating: 'Updating...',
        success: 'Profile updated successfully',
        error: 'Failed to update profile'
      },
      password: {
        title: 'Change Password',
        current: 'Current Password',
        new: 'New Password',
        confirm: 'Confirm New Password',
        passwordNote: 'Must be at least 8 characters long.',
        changeButton: 'Change Password',
        changing: 'Changing...',
        success: 'Password changed successfully',
        error: 'Failed to change password',
        validationError: 'New passwords do not match'
      }
    }
  }
};

// Create a writable store for the current language - now always 'en'
export const language: Writable<Language> = writable('en');

// Language constants - now only English
export const LANGUAGES = [
  { code: 'en' as Language, name: 'English' }
] as const;

// Initialize language - always English now
const initLang = (): Language => {
  return 'en';
};

// Initialize the language store
language.set(initLang());

// Translation function - simplified since we only have English
export function t(key: string, lang: Language): string {
  const keys = key.split('.');
  let current: any = translations[lang];
  
  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k];
    } else {
      console.warn(`Translation key "${key}" not found for language "${lang}"`);
      return key; // Return the key if translation not found
    }
  }
  
  return typeof current === 'string' ? current : key;
}

// Export the current language value (always 'en')
export const currentLanguage = 'en'; 