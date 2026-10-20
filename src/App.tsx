import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { PropertyListings } from './components/PropertyListings';
import { AllPropertiesView } from './components/AllPropertiesView';
import { PropertyDetailsPage } from './components/PropertyDetailsPage';
import { Footer } from './components/Footer';
import { GoogleSignInModal } from './components/GoogleSignInModal';
import { FavoritesDrawer } from './components/FavoritesDrawer';
import { InquiryModal } from './components/InquiryModal';
import { AddPropertyModal } from './components/AddPropertyModal';
import { AIAssistantModal } from './components/AIAssistantModal';
import { AdminPortalModal } from './components/AdminPortalModal';
import { BookingModal } from './components/BookingModal';
import { AICallWidget } from './AICallWidget';
import { Property, Language, SearchFilterState } from './types';
import { mockProperties } from './data/properties';
import { authService, GoogleUser } from './services/authService';
import { X, MessageCircle, Phone, Sparkles, Calendar } from 'lucide-react';

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [inquiryModalOpen, setInquiryModalOpen] = useState<boolean>(false);
  const [bookingModalOpen, setBookingModalOpen] = useState<boolean>(false);
  const [bookingProperty, setBookingProperty] = useState<Property | null>(null);
  const [addPropertyModalOpen, setAddPropertyModalOpen] = useState<boolean>(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState<boolean>(false);
  const [aiCallWidgetOpen, setAiCallWidgetOpen] = useState<boolean>(false);
  const [aiCallAutoStart, setAiCallAutoStart] = useState<boolean>(false);
  const [adminPortalOpen, setAdminPortalOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'home' | 'all_properties' | 'property_details'>('home');
  const [allPropertiesInitialCat, setAllPropertiesInitialCat] = useState<string>('all');

  const [lastMohammadFilter, setLastMohammadFilter] = useState<{
    location?: string;
    propertyType?: string;
    action?: string;
    timestamp: number;
  } | null>(null);
  const [lastMohammadAppointment, setLastMohammadAppointment] = useState<{
    text: string;
    timestamp: number;
  } | null>(null);

  // Google OAuth User Session & Wishlist Favorites
  const [currentUser, setCurrentUser] = useState<GoogleUser | null>(() => authService.getUser());
  const [favorites, setFavorites] = useState<string[]>(() => authService.getFavorites());
  const [googleSignInOpen, setGoogleSignInOpen] = useState<boolean>(false);
  const [favoritesDrawerOpen, setFavoritesDrawerOpen] = useState<boolean>(false);
  const [pendingFavoriteProp, setPendingFavoriteProp] = useState<Property | null>(null);

  // Load custom properties added by admin, combined with initial mockProperties
  const [properties, setProperties] = useState<Property[]>(() => {
    try {
      const stored = localStorage.getItem('next_custom_properties');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return [...parsed, ...mockProperties];
        }
      }
    } catch (e) {
      console.warn('Failed to load local properties', e);
    }
    return mockProperties;
  });

  const [activeFilters, setActiveFilters] = useState<SearchFilterState>({
    location: '',
    propertyType: '',
    saleOrRental: '',
    buildingAge: '',
    areaRange: '',
  });

  const [filterNotification, setFilterNotification] = useState<string | null>(null);
  const isArabic = lang === 'ar';

  // Keep html document dir and lang synchronized
  useEffect(() => {
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [isArabic, lang]);

  // Requirement 1: Launcher visibility controls (hide on mobile when footer is visible or when overlays/filters are open)
  const [isFooterVisibleOnMobile, setIsFooterVisibleOnMobile] = useState<boolean>(false);
  const [isOverlayOrFilterOpen, setIsOverlayOrFilterOpen] = useState<boolean>(false);

  useEffect(() => {
    const footerEl = document.getElementById('main-footer');
    if (!footerEl) return;

    const checkFooterIntersection = () => {
      const isMobile = window.innerWidth < 640;
      if (!isMobile) {
        setIsFooterVisibleOnMobile(false);
        return;
      }
      const rect = footerEl.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      setIsFooterVisibleOnMobile(inView);
    };

    const observer = new IntersectionObserver(
      () => {
        checkFooterIntersection();
      },
      { threshold: [0, 0.05, 0.1, 0.2, 0.5] }
    );

    observer.observe(footerEl);
    window.addEventListener('scroll', checkFooterIntersection, { passive: true });
    window.addEventListener('resize', checkFooterIntersection, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', checkFooterIntersection);
      window.removeEventListener('resize', checkFooterIntersection);
    };
  }, []);

  useEffect(() => {
    const checkOverlays = () => {
      const hasBackdropModal = Boolean(
        document.querySelector('.fixed.inset-0.z-50, .fixed.inset-0.z-60, #advanced-filter-panel')
      );
      setIsOverlayOrFilterOpen(hasBackdropModal);
    };

    const interval = setInterval(checkOverlays, 250);
    return () => clearInterval(interval);
  }, []);

  const isModalOrMenuOpen =
    inquiryModalOpen ||
    bookingModalOpen ||
    addPropertyModalOpen ||
    aiAssistantOpen ||
    adminPortalOpen ||
    googleSignInOpen ||
    favoritesDrawerOpen ||
    isOverlayOrFilterOpen;

  const hideFloatingLauncher =
    aiCallWidgetOpen || isModalOrMenuOpen || isFooterVisibleOnMobile;

  // Synchronize high-concurrency property listings from backend API
  useEffect(() => {
    fetch('/api/properties')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.properties) && data.properties.length > 0) {
          setProperties(data.properties);
        }
      })
      .catch(() => {
        // Safe offline / mock fallback
      });
  }, []);

  // Synchronize hash routing with full page view
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/property/')) {
        const id = hash.replace('#/property/', '');
        const found = properties.find((p) => p.id === id);
        if (found) {
          setSelectedProperty(found);
          setViewMode('property_details');
          return;
        }
      } else if (hash === '#/all-properties') {
        setViewMode('all_properties');
        return;
      } else if (!hash || hash === '#/' || hash === '#home') {
        setViewMode('home');
      }
    };

    handleHashChange();
    window.addEventListener('popstate', handleHashChange);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('popstate', handleHashChange);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [properties]);

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'en' ? 'ar' : 'en'));
  };

  const handleToggleFavorite = (property: Property, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Check if user is logged in via Google OAuth
    if (!currentUser) {
      setPendingFavoriteProp(property);
      setGoogleSignInOpen(true);
      return;
    }

    // Toggle favorite in storage and state
    const result = authService.toggleFavorite(property.id);
    setFavorites(result.list);
  };

  const handleGoogleSuccess = (user: GoogleUser) => {
    setCurrentUser(user);
    if (pendingFavoriteProp) {
      const result = authService.toggleFavorite(pendingFavoriteProp.id);
      setFavorites(result.list);
      setPendingFavoriteProp(null);
    }
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
  };

  const handleAddProperty = (newProp: Property) => {
    setProperties((prev) => {
      const updated = [newProp, ...prev];
      try {
        const customOnly = updated.filter((p) => p.id.startsWith('custom-'));
        localStorage.setItem('next_custom_properties', JSON.stringify(customOnly));
      } catch (e) {}
      return updated;
    });
  };

  const handleDeleteProperty = (id: string) => {
    setProperties((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      try {
        const customOnly = updated.filter((p) => p.id.startsWith('custom-'));
        localStorage.setItem('next_custom_properties', JSON.stringify(customOnly));
      } catch (e) {}
      return updated;
    });
  };

  const handleUpdateProperty = (updatedProp: Property) => {
    setProperties((prev) => {
      const updated = prev.map((p) => (p.id === updatedProp.id ? updatedProp : p));
      try {
        const customOnly = updated.filter((p) => p.id.startsWith('custom-'));
        localStorage.setItem('next_custom_properties', JSON.stringify(customOnly));
      } catch (e) {}
      return updated;
    });
  };

  const handleSearch = (filters: SearchFilterState) => {
    setActiveFilters(filters);
    if (filters.propertyType) {
      setActiveCategory(filters.propertyType);
    }

    const parts: string[] = [];
    if (filters.location) parts.push(`${isArabic ? 'الموقع' : 'Location'}: ${filters.location}`);
    if (filters.propertyType) parts.push(`${isArabic ? 'النوع' : 'Type'}: ${filters.propertyType}`);
    if (filters.saleOrRental)
      parts.push(
        filters.saleOrRental === 'sale'
          ? isArabic
            ? 'للبيع'
            : 'For Sale'
          : isArabic
          ? 'للإيجار'
          : 'For Rent'
      );
    if (filters.minPrice || filters.maxPrice) {
      parts.push(
        `${isArabic ? 'السعر' : 'Price'}: $${filters.minPrice || 0} - ${
          filters.maxPrice ? '$' + filters.maxPrice.toLocaleString() : '∞'
        }`
      );
    }
    if (filters.minArea || filters.maxArea) {
      parts.push(
        `${isArabic ? 'المساحة' : 'Area'}: ${filters.minArea || 0} - ${
          filters.maxArea || '∞'
        } m²`
      );
    }
    if (filters.bedrooms && filters.bedrooms !== 'any') {
      parts.push(`${isArabic ? 'غرف النوم' : 'Bedrooms'}: ${filters.bedrooms}`);
    }
    if (filters.bathrooms && filters.bathrooms !== 'any') {
      parts.push(`${isArabic ? 'الحمامات' : 'Bathrooms'}: ${filters.bathrooms}`);
    }
    if (filters.floor && filters.floor !== 'any') {
      parts.push(`${isArabic ? 'الطابق' : 'Floor'}: ${filters.floor}`);
    }
    if (filters.buildingAge)
      parts.push(`${isArabic ? 'عمر البناية' : 'Building Age'}: ${filters.buildingAge}`);
    if (filters.furnished && filters.furnished !== 'any') {
      parts.push(`${isArabic ? 'الفرش' : 'Furnished'}: ${filters.furnished}`);
    }
    if (filters.areaRange)
      parts.push(`${isArabic ? 'المساحة' : 'Area'}: ${filters.areaRange} m²`);

    const summary =
      parts.length > 0
        ? parts.join(' • ')
        : isArabic
        ? 'عرض كافة العقارات المتاحة في لبنان'
        : 'Showing all available listings in Lebanon';
    setFilterNotification(summary);

    const listingsEl = document.getElementById('properties-section');
    if (listingsEl) {
      listingsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleApplyFilterFromAI = (filterArgs: {
    location?: string;
    propertyType?: string;
    buildingAge?: string;
    saleOrRental?: string;
  }) => {
    const updated: SearchFilterState = {
      ...activeFilters,
      location: filterArgs.location || '',
      propertyType: filterArgs.propertyType || '',
      buildingAge: filterArgs.buildingAge || '',
      saleOrRental: filterArgs.saleOrRental || '',
    };
    setActiveFilters(updated);
    if (filterArgs.propertyType) {
      setActiveCategory(filterArgs.propertyType);
    }
    setFilterNotification(
      isArabic
        ? `تصفية موصى بها من المستشار الذكي: ${filterArgs.location || ''} ${
            filterArgs.propertyType || ''
          }`
        : `AI Recommended Filter: ${filterArgs.location || ''} ${filterArgs.propertyType || ''}`
    );
    const listingsEl = document.getElementById('properties-section');
    if (listingsEl) {
      listingsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Booking Modal Trigger
  const handleOpenBooking = (property?: Property | null) => {
    setBookingProperty(property || null);
    setBookingModalOpen(true);
  };

  // Dynamic Navigation to Property Details
  const handleViewProperty = (propId: string) => {
    const found = properties.find(
      (p) =>
        p.id === propId ||
        p.referenceNo.toLowerCase() === propId.toLowerCase() ||
        p.id.toLowerCase().includes(propId.toLowerCase())
    );
    if (found) {
      setSelectedProperty(found);
      setViewMode('property_details');
      window.location.hash = `#/property/${found.id}`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Mohammad AI Voice Client Tool Handler: filter_properties
  const handleMohammadFilter = (filterArgs: {
    location?: string;
    propertyType?: string;
    action?: string;
    budget?: string;
    propertyId?: string;
    referenceNo?: string;
  }) => {
    // If a specific property ID or reference is requested, navigate directly
    const targetPropId = filterArgs.propertyId || filterArgs.referenceNo;
    if (targetPropId) {
      handleViewProperty(targetPropId);
    }

    const updated: SearchFilterState = {
      ...activeFilters,
      location: filterArgs.location || '',
      propertyType: filterArgs.propertyType || '',
      budget: filterArgs.budget || '',
      saleOrRental:
        filterArgs.action === 'sale'
          ? 'sale'
          : filterArgs.action === 'rental'
          ? 'rental'
          : activeFilters.saleOrRental || '',
    };
    setActiveFilters(updated);
    if (filterArgs.propertyType) {
      setActiveCategory(filterArgs.propertyType);
    }
    setLastMohammadFilter({
      location: filterArgs.location,
      propertyType: filterArgs.propertyType,
      action: filterArgs.action,
      timestamp: Date.now(),
    });

    const parts: string[] = [];
    if (filterArgs.location) parts.push(`${isArabic ? 'الموقع' : 'Location'}: ${filterArgs.location}`);
    if (filterArgs.propertyType) parts.push(`${isArabic ? 'النوع' : 'Type'}: ${filterArgs.propertyType}`);
    if (filterArgs.budget) parts.push(`${isArabic ? 'الميزانية' : 'Budget'}: ${filterArgs.budget}`);
    if (filterArgs.action) {
      parts.push(
        filterArgs.action === 'sale'
          ? isArabic
            ? 'للبيع'
            : 'For Sale'
          : isArabic
          ? 'للإيجار'
          : 'For Rent'
      );
    }

    setFilterNotification(
      parts.length > 0
        ? isArabic
          ? `تصفية مباشرة من محمد AI: ${parts.join(' • ')}`
          : `Live Filter from Mohammad AI: ${parts.join(' • ')}`
        : isArabic
        ? 'عرض كافة العقارات المتاحة في لبنان'
        : 'Showing all available listings in Lebanon'
    );

    if (!targetPropId && viewMode !== 'home') {
      setViewMode('home');
    }

    setTimeout(() => {
      const listingsEl = document.getElementById('properties-section');
      if (listingsEl && !targetPropId) {
        listingsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  };

  // Mohammad AI Voice Client Tool Handler: schedule_appointment
  const handleMohammadAppointment = (appointmentData?: any) => {
    let summary = '';
    if (typeof appointmentData === 'string') {
      summary = appointmentData;
    } else if (appointmentData && typeof appointmentData === 'object') {
      const { name, phone, date, time, location, property_type } = appointmentData;
      const fragments = [name, phone, date, time, location, property_type].filter(Boolean);
      summary =
        fragments.length > 0
          ? fragments.join(' - ')
          : isArabic
          ? 'طلب موعد معاينة عقار لدى Next Real Estate'
          : 'Property viewing appointment requested';
    } else {
      summary = isArabic
        ? 'طلب موعد معاينة عقار لدى Next Real Estate'
        : 'Property viewing appointment requested';
    }

    setLastMohammadAppointment({
      text: summary,
      timestamp: Date.now(),
    });

    setFilterNotification(
      isArabic
        ? `تم تسجيل موعد المعاينة بنجاح بواسطة محمد AI: ${summary}`
        : `Viewing appointment captured via Mohammad AI: ${summary}`
    );
  };

  // Event listener for ElevenLabs Conversational AI client tools & events
  useEffect(() => {
    const handleToolCall = (event: any) => {
      const detail = event.detail || event.data || {};
      const toolName =
        detail.toolName ||
        detail.name ||
        detail.tool ||
        (typeof detail === 'object' && detail.clientTool);
      const params =
        detail.parameters || detail.args || detail.params || detail.arguments || {};

      if (toolName === 'filter_properties') {
        handleMohammadFilter(params);
        if (typeof detail.respond === 'function') {
          detail.respond({ success: true, count: properties.length });
        } else if (typeof detail.callback === 'function') {
          detail.callback({ success: true });
        }
      } else if (toolName === 'schedule_appointment') {
        handleMohammadAppointment(params);
        if (typeof detail.respond === 'function') {
          detail.respond({ success: true, message: 'Appointment captured' });
        } else if (typeof detail.callback === 'function') {
          detail.callback({ success: true });
        }
      }
    };

    const handleWindowMsg = (event: MessageEvent) => {
      if (!event.data) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.type?.includes('tool') || data.toolName) {
          handleToolCall({ detail: data });
        }
      } catch {}
    };

    const widget = document.querySelector('elevenlabs-convai');
    if (widget) {
      widget.addEventListener('elevenlabs-convai:call', handleToolCall);
      widget.addEventListener('call', handleToolCall);
      widget.addEventListener('elevenlabs:call', handleToolCall);
      widget.addEventListener('clientTool', handleToolCall);
    }

    window.addEventListener('elevenlabs-convai:call', handleToolCall);
    window.addEventListener('message', handleWindowMsg);

    return () => {
      if (widget) {
        widget.removeEventListener('elevenlabs-convai:call', handleToolCall);
        widget.removeEventListener('call', handleToolCall);
        widget.removeEventListener('elevenlabs:call', handleToolCall);
        widget.removeEventListener('clientTool', handleToolCall);
      }
      window.removeEventListener('elevenlabs-convai:call', handleToolCall);
      window.removeEventListener('message', handleWindowMsg);
    };
  }, [properties, activeFilters, isArabic, viewMode]);

  const handleResetFilters = () => {
    setActiveFilters({
      location: '',
      propertyType: '',
      saleOrRental: '',
      buildingAge: '',
      areaRange: '',
      minPrice: undefined,
      maxPrice: undefined,
      minArea: undefined,
      maxArea: undefined,
      bedrooms: '',
      bathrooms: '',
      floor: '',
      furnished: '',
      budget: '',
    });
    setActiveCategory('all');
    setFilterNotification(null);
  };

  const handleNavigation = (route: string) => {
    if (route === 'home') {
      window.location.hash = '#/';
      setViewMode('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (route === 'add-property') {
      setAddPropertyModalOpen(true);
    } else if (route === 'contact') {
      setSelectedProperty(null);
      setInquiryModalOpen(true);
    } else if (route === 'properties') {
      if (viewMode === 'all_properties') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const el = document.getElementById('properties-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (route === 'signin') {
      setAdminPortalOpen(true);
    }
  };

  const handleOpenPropertyDetails = (property: Property) => {
    setSelectedProperty(property);
    setViewMode('property_details');
    window.location.hash = `#/property/${property.id}`;
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleSelectPropertyById = (id: string) => {
    const found = properties.find((p) => p.id === id);
    if (found) {
      setSelectedProperty(found);
      setViewMode('property_details');
      window.location.hash = `#/property/${found.id}`;
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const handleSeeAll = (section: 'platinum' | 'trending' | 'all') => {
    setAllPropertiesInitialCat(activeCategory);
    window.location.hash = '#/all-properties';
    setViewMode('all_properties');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      className={`min-h-screen flex flex-col bg-white text-[#212121] selection:bg-[#c4191a] selection:text-white ${
        isArabic ? 'font-cairo' : 'font-prompt'
      }`}
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      {/* 
        1. Top Header: 
        - Clean branding (logo + Next Real Estate, no awkward wrapping)
        - Clean hamburger menu button
        - Notification bell & PWA install
        - Admin portal hidden inside three-dots menu
        - Wishlist Favorites trigger with real-time count
      */}
      <Header
        onNavigate={handleNavigation}
        lang={lang}
        onToggleLang={toggleLanguage}
        onOpenAIAssistant={() => setAiCallWidgetOpen(true)}
        onOpenAdminPortal={() => setAdminPortalOpen(true)}
        onSelectPropertyId={handleSelectPropertyById}
        isLightHeader={viewMode === 'all_properties' || viewMode === 'property_details'}
        onOpenFavorites={() => setFavoritesDrawerOpen(true)}
        favoritesCount={favorites.length}
      />

      {/* Main Content Area: Dedicated Property Page, Catalog, or Home */}
      {viewMode === 'property_details' && selectedProperty ? (
        <PropertyDetailsPage
          property={selectedProperty}
          allProperties={properties}
          lang={lang}
          onBack={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              window.location.hash = '#/';
              setViewMode('home');
            }
          }}
          onNavigateAllProperties={() => {
            window.location.hash = '#/all-properties';
            setViewMode('all_properties');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onSelectProperty={handleOpenPropertyDetails}
          isFavorite={favorites.includes(selectedProperty.id)}
          onToggleFavorite={handleToggleFavorite}
          favorites={favorites}
          onSearch={handleSearch}
          onBookViewing={handleOpenBooking}
        />
      ) : viewMode === 'all_properties' ? (
        /* Full Catalog View when user clicks "See All" */
        <AllPropertiesView
          properties={properties}
          initialCategory={allPropertiesInitialCat}
          lang={lang}
          onBack={() => {
            window.location.hash = '#/';
            setViewMode('home');
          }}
          onSelectProperty={handleOpenPropertyDetails}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
        />
      ) : (
        /* Home Page View */
        <main className="flex-grow">
          {/* 
            2. Hero Section: 
            - Subtitle text permanently deleted ("YOUR NEXT CHAPTER IS HERE" completely removed)
            - Location cascade dropdown with clear down-arrow indicator
            - Search button: Wide & appropriately proportioned, arrow icon removed, flat & professional
            - High transparency glassmorphic design
          */}
          <HeroSection
            lang={lang}
            onSearch={handleSearch}
            activeFilters={activeFilters}
          />

          {/* Dynamic Search Filter Results Indicator */}
          {filterNotification && (
            <div className="bg-[#18191a] text-white py-3 px-4 text-center text-xs sm:text-sm border-b border-white/10 flex items-center justify-center gap-3 animate-in fade-in duration-200">
              <span className="text-[#c4191a] font-bold uppercase tracking-wider">
                {isArabic ? 'نتائج التصفية:' : 'Filtered Results:'}
              </span>
              <span className="text-white/90 font-medium truncate max-w-xl">
                {filterNotification}
              </span>
              <button
                onClick={handleResetFilters}
                className="text-xs text-white/70 hover:text-white underline ml-2 flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>{isArabic ? 'إلغاء التصفية' : 'Reset'}</span>
              </button>
            </div>
          )}


          {/* 
            4. Curated Property Listings:
            - Platinum and Trending horizontal swipeable carousels dynamically sorted with newest properties first
            - Instant friction-free Google OAuth for favorites
          */}
          <div id="properties-section">
            <PropertyListings
              properties={properties}
              filterType={activeCategory}
              filters={activeFilters}
              lang={lang}
              onSelectProperty={handleOpenPropertyDetails}
              onResetFilters={handleResetFilters}
              onSeeAll={handleSeeAll}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
            />
          </div>
        </main>
      )}

      {/* 
        5. Clean Minimal Compact Footer:
        - Essential links (Properties, Add a Property, Contact Us)
        - Social media icons (TikTok, Facebook, Instagram, WhatsApp)
      */}
      <Footer
        lang={lang}
        onNavigate={handleNavigation}
        onOpenAdmin={() => setAdminPortalOpen(true)}
      />

      {/* Google OAuth Modal for Favorites */}
      <GoogleSignInModal
        isOpen={googleSignInOpen}
        onClose={() => {
          setGoogleSignInOpen(false);
          setPendingFavoriteProp(null);
        }}
        onSuccess={handleGoogleSuccess}
        lang={lang}
        pendingPropertyTitle={
          pendingFavoriteProp
            ? isArabic
              ? pendingFavoriteProp.titleAr
              : pendingFavoriteProp.title
            : undefined
        }
      />

      {/* Saved Properties Drawer */}
      <FavoritesDrawer
        isOpen={favoritesDrawerOpen}
        onClose={() => setFavoritesDrawerOpen(false)}
        favorites={favorites}
        properties={properties}
        onSelectProperty={(prop) => {
          setFavoritesDrawerOpen(false);
          handleOpenPropertyDetails(prop);
        }}
        onRemoveFavorite={(id) => {
          const res = authService.toggleFavorite(id);
          setFavorites(res.list);
        }}
        user={currentUser}
        onLogout={handleLogout}
        lang={lang}
      />

      {/* General Inquiry / Contact Modal */}
      <InquiryModal
        isOpen={inquiryModalOpen}
        onClose={() => setInquiryModalOpen(false)}
        property={selectedProperty}
        lang={lang}
      />

      {/* Online Booking System Modal */}
      <BookingModal
        isOpen={bookingModalOpen}
        onClose={() => {
          setBookingModalOpen(false);
          setBookingProperty(null);
        }}
        property={bookingProperty || selectedProperty}
        lang={lang}
      />

      <AddPropertyModal
        isOpen={addPropertyModalOpen}
        onClose={() => setAddPropertyModalOpen(false)}
        lang={lang}
      />

      <AIAssistantModal
        isOpen={aiAssistantOpen}
        onClose={() => setAiAssistantOpen(false)}
        lang={lang}
        onSelectProperty={handleOpenPropertyDetails}
        onApplyFilter={handleApplyFilterFromAI}
      />

      {/* Admin Portal Modal (Protected with Administrator Credentials) */}
      <AdminPortalModal
        isOpen={adminPortalOpen}
        onClose={() => setAdminPortalOpen(false)}
        properties={properties}
        onAddProperty={handleAddProperty}
        onDeleteProperty={handleDeleteProperty}
        onUpdateProperty={handleUpdateProperty}
        lang={lang}
      />


      {/* 
        Floating Action Button (FAB) - Mohammad AI Launcher:
        - Mobile: right 12px, bottom calc(12px + env(safe-area-inset-bottom, 0px)), 48px
        - Desktop: right 24px, bottom 24px, 56px
        - Fades out (opacity 0, pointer-events none) when footer is visible on mobile or when any modal/menu/filter is open
        - Tooltip appears ONLY on desktop hover, never on mobile
      */}
      <button
        onClick={() => {
          setAiCallWidgetOpen(true);
        }}
        aria-label={isArabic ? 'تحدث مع محمد AI' : 'Talk with Mohammad AI'}
        className={`fixed z-[9999] rounded-full bg-[#0b3c35] hover:bg-[#072823] active:scale-95 shadow-xl hover:shadow-2xl transition-all duration-300 p-0.5 border-2 border-emerald-400/80 cursor-pointer flex items-center justify-center select-none group ${
          hideFloatingLauncher
            ? 'opacity-0 pointer-events-none'
            : 'opacity-100 pointer-events-auto'
        } right-[12px] bottom-[calc(12px+env(safe-area-inset-bottom,0px))] sm:right-[24px] sm:bottom-[24px] w-[48px] h-[48px] sm:w-[56px] sm:h-[56px]`}
      >
        {/* Circular Mohammad Avatar */}
        <div className="relative w-full h-full rounded-full overflow-visible flex items-center justify-center">
          <img
            src="/mohammad-avatar.jpg"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/assets/mohammad-avatar.jpg';
            }}
            alt="Mohammad AI"
            className="w-full h-full rounded-full object-cover group-hover:scale-105 transition-transform"
          />

          {/* Small Green Badge with Phone Icon */}
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md border border-white"
          >
            <Phone className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
          </span>

          {/* Live Pulsating Online Dot */}
          <span
            className="absolute -bottom-0.5 -left-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-400 rounded-full border-2 border-[#0b3c35] animate-pulse"
          />
        </div>

        {/* Desktop-only hover tooltip (Never rendered or shown on mobile) */}
        <div className="hidden sm:group-hover:flex items-center absolute right-[68px] rtl:right-auto rtl:left-[68px] bg-[#0b3c35] text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-xl border border-emerald-500/30 whitespace-nowrap pointer-events-none animate-in fade-in slide-in-from-right-1 duration-150">
          {isArabic ? 'تحدث مع محمد' : 'Talk with Mohammad'}
        </div>
      </button>


      {/* 
        Mohammad Voice AI Call Widget:
        - Messenger-style floating card in bottom-right corner (fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9999])
        - Compact size on mobile (w-[calc(100vw-2rem)] max-w-[340px] sm:max-w-[360px])
        - Hybrid Chat: Text input + voice call integration
        - Background site remains completely visible (no screen darkening backdrop modal)
      */}
      <AICallWidget
        isOpen={aiCallWidgetOpen}
        onClose={() => {
          setAiCallWidgetOpen(false);
          setAiCallAutoStart(false);
        }}
        lang={lang}
        onFilterProperties={handleMohammadFilter}
        onScheduleAppointment={handleMohammadAppointment}
        onViewProperty={handleViewProperty}
        lastFilterAction={lastMohammadFilter}
        lastAppointmentAction={lastMohammadAppointment}
        autoStart={aiCallAutoStart}
      />
    </div>
  );
}
