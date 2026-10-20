import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Home,
  Calendar,
  Maximize2,
  SlidersHorizontal,
  ChevronDown,
  Check,
  X,
  RotateCcw,
  DollarSign,
  Bed,
  Bath,
  Layers,
  Armchair,
  Search,
} from 'lucide-react';
import { Language, SearchFilterState } from '../types';
import { BUILDING_AGES, PROPERTY_TYPES } from '../data/properties';
import { LocationCascadeDropdown } from './LocationCascadeDropdown';

interface HeroSectionProps {
  lang: Language;
  onSearch?: (filters: SearchFilterState) => void;
  activeFilters?: SearchFilterState;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  lang,
  onSearch,
  activeFilters,
}) => {
  const isArabic = lang === 'ar';

  // Primary Search Fields
  const [location, setLocation] = useState(activeFilters?.location || '');
  const [propertyType, setPropertyType] = useState(activeFilters?.propertyType || '');
  const [saleOrRental, setSaleOrRental] = useState(activeFilters?.saleOrRental || '');

  // Advanced Filter Fields
  const [minPrice, setMinPrice] = useState<string>(
    activeFilters?.minPrice ? String(activeFilters.minPrice) : ''
  );
  const [maxPrice, setMaxPrice] = useState<string>(
    activeFilters?.maxPrice ? String(activeFilters.maxPrice) : ''
  );
  const [minArea, setMinArea] = useState<string>(
    activeFilters?.minArea ? String(activeFilters.minArea) : ''
  );
  const [maxArea, setMaxArea] = useState<string>(
    activeFilters?.maxArea ? String(activeFilters.maxArea) : ''
  );
  const [bedrooms, setBedrooms] = useState<string>(activeFilters?.bedrooms || '');
  const [bathrooms, setBathrooms] = useState<string>(activeFilters?.bathrooms || '');
  const [floor, setFloor] = useState<string>(activeFilters?.floor || '');
  const [buildingAge, setBuildingAge] = useState(activeFilters?.buildingAge || '');
  const [furnished, setFurnished] = useState<string>(activeFilters?.furnished || '');

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Custom popups state
  const [saleOrRentalOpen, setSaleOrRentalOpen] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);

  const saleOrRentalRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (saleOrRentalRef.current && !saleOrRentalRef.current.contains(e.target as Node)) {
        setSaleOrRentalOpen(false);
      }
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) {
        setTypeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Sync with activeFilters
  useEffect(() => {
    if (activeFilters) {
      if (activeFilters.location !== undefined) setLocation(activeFilters.location);
      if (activeFilters.propertyType !== undefined) setPropertyType(activeFilters.propertyType);
      if (activeFilters.saleOrRental !== undefined) setSaleOrRental(activeFilters.saleOrRental);
      if (activeFilters.minPrice !== undefined)
        setMinPrice(activeFilters.minPrice ? String(activeFilters.minPrice) : '');
      if (activeFilters.maxPrice !== undefined)
        setMaxPrice(activeFilters.maxPrice ? String(activeFilters.maxPrice) : '');
      if (activeFilters.minArea !== undefined)
        setMinArea(activeFilters.minArea ? String(activeFilters.minArea) : '');
      if (activeFilters.maxArea !== undefined)
        setMaxArea(activeFilters.maxArea ? String(activeFilters.maxArea) : '');
      if (activeFilters.bedrooms !== undefined) setBedrooms(activeFilters.bedrooms);
      if (activeFilters.bathrooms !== undefined) setBathrooms(activeFilters.bathrooms);
      if (activeFilters.floor !== undefined) setFloor(activeFilters.floor);
      if (activeFilters.buildingAge !== undefined) setBuildingAge(activeFilters.buildingAge);
      if (activeFilters.furnished !== undefined) setFurnished(activeFilters.furnished);

      if (
        activeFilters.minPrice ||
        activeFilters.maxPrice ||
        activeFilters.minArea ||
        activeFilters.maxArea ||
        activeFilters.bedrooms ||
        activeFilters.bathrooms ||
        activeFilters.floor ||
        activeFilters.buildingAge ||
        activeFilters.furnished
      ) {
        setShowAdvancedFilters(true);
      }
    }
  }, [activeFilters]);

  // High-end real estate background image
  const heroBgImage =
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2560&q=85';

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
      if (onSearch) {
        onSearch({
          location,
          propertyType,
          saleOrRental,
          buildingAge,
          areaRange: '',
          minPrice: minPrice ? Number(minPrice) : undefined,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          minArea: minArea ? Number(minArea) : undefined,
          maxArea: maxArea ? Number(maxArea) : undefined,
          bedrooms: bedrooms || undefined,
          bathrooms: bathrooms || undefined,
          floor: floor || undefined,
          furnished: furnished || undefined,
        });
      }
    }, 150);
  };

  const handleResetAdvanced = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setMinPrice('');
    setMaxPrice('');
    setMinArea('');
    setMaxArea('');
    setBedrooms('');
    setBathrooms('');
    setFloor('');
    setBuildingAge('');
    setFurnished('');

    if (onSearch) {
      onSearch({
        location,
        propertyType,
        saleOrRental,
        buildingAge: '',
        areaRange: '',
        minPrice: undefined,
        maxPrice: undefined,
        minArea: undefined,
        maxArea: undefined,
        bedrooms: undefined,
        bathrooms: undefined,
        floor: undefined,
        furnished: undefined,
      });
    }
  };

  // Count active extra filters
  const activeExtraFiltersCount = [
    minPrice,
    maxPrice,
    minArea,
    maxArea,
    bedrooms && bedrooms !== 'any',
    bathrooms && bathrooms !== 'any',
    floor && floor !== 'any',
    buildingAge,
    furnished && furnished !== 'any',
  ].filter(Boolean).length;

  const selectedTypeObj = PROPERTY_TYPES.find((t) => t.id === propertyType);

  return (
    <section
      id="hero-section"
      className="relative z-20 min-h-[440px] lg:min-h-[480px] flex items-center justify-center pt-24 pb-8 lg:pt-30 lg:pb-10 overflow-visible"
      style={{
        backgroundImage: `url(${heroBgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      {/* Precision Soft Dark Gradient Overlay */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: 'linear-gradient(269.47deg, rgba(0, 0, 0, 0.28) 15%, rgba(0, 0, 0, 0.62) 85%)',
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/35 to-transparent z-[2] pointer-events-none" />

      <div className="confidence-container relative z-10 w-full flex flex-col items-center text-center px-4 overflow-visible">
        {/* Brand Headline: Next Real Estate */}
        <div className="max-w-3xl mx-auto mb-5 sm:mb-7">
          <h1
            className="text-white text-3xl sm:text-4xl md:text-[44px] font-bold tracking-tight drop-shadow-md"
            style={{ fontFamily: isArabic ? "'Cairo', sans-serif" : "'Prompt', sans-serif" }}
          >
            Next Real Estate
          </h1>
        </div>

        {/* 
          RESPONSIVE HERO SEARCH BAR:
          1. Desktop (lg+): Horizontal layout where Location, Type, Sale/Rental, and Search Button sit side-by-side in one row.
          2. Mobile/Tablet: Gracefully stacks vertically.
        */}
        <div className="w-full max-w-[500px] lg:max-w-4xl xl:max-w-5xl overflow-visible relative z-30">
          <form onSubmit={handleSearchSubmit} className="space-y-3 overflow-visible">
            {/* Main Fields Container */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5 overflow-visible">
              
              {/* Field 1: Location Cascade Dropdown */}
              <div className="w-full lg:flex-[1.4] relative z-40">
                <LocationCascadeDropdown value={location} onChange={setLocation} lang={lang} />
              </div>

              {/* Field 2: Property Type Dropdown */}
              <div ref={typeRef} className="relative w-full lg:flex-1 text-start z-30">
                <button
                  type="button"
                  onClick={() => {
                    setTypeDropdownOpen(!typeDropdownOpen);
                    setSaleOrRentalOpen(false);
                  }}
                  className="w-full h-10 px-3 flex items-center justify-between bg-black/30 hover:bg-black/40 focus:bg-black/50 text-white text-xs sm:text-sm font-normal rounded-lg border border-white/50 focus:border-white focus:outline-none transition-all shadow-sm cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Building2 className="w-3.5 h-3.5 text-white/70 shrink-0" />
                    <span className="truncate">
                      {selectedTypeObj
                        ? isArabic
                          ? selectedTypeObj.nameAr
                          : selectedTypeObj.nameEn
                        : isArabic
                        ? 'نوع العقار'
                        : 'Property Type'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {propertyType && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setPropertyType('');
                        }}
                        className="hover:text-red-400 p-0.5"
                      >
                        <X className="w-3 h-3 text-white/70" />
                      </span>
                    )}
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-white/70 transition-transform ${
                        typeDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {typeDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-full min-w-[200px] bg-white text-gray-800 rounded-lg shadow-2xl border border-gray-200 overflow-hidden z-50 text-xs sm:text-sm max-h-64 overflow-y-auto animate-in fade-in duration-100">
                    <div
                      onClick={() => {
                        setPropertyType('');
                        setTypeDropdownOpen(false);
                      }}
                      className={`px-3.5 py-2.5 hover:bg-gray-100 cursor-pointer flex items-center justify-between transition-colors ${
                        !propertyType ? 'bg-red-50 text-[#c4191a] font-bold' : ''
                      }`}
                    >
                      <span>{isArabic ? 'كافة الأنواع' : 'All Types'}</span>
                      {!propertyType && <Check className="w-4 h-4 text-[#c4191a]" />}
                    </div>
                    {PROPERTY_TYPES.map((type) => {
                      const active = propertyType === type.id;
                      return (
                        <div
                          key={type.id}
                          onClick={() => {
                            setPropertyType(type.id);
                            setTypeDropdownOpen(false);
                          }}
                          className={`px-3.5 py-2.5 hover:bg-gray-100 cursor-pointer flex items-center justify-between border-t border-gray-100 transition-colors ${
                            active ? 'bg-red-50 text-[#c4191a] font-bold' : ''
                          }`}
                        >
                          <span>{isArabic ? type.nameAr : type.nameEn}</span>
                          {active && <Check className="w-4 h-4 text-[#c4191a]" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Field 3: Sale or Rental Dropdown */}
              <div ref={saleOrRentalRef} className="relative w-full lg:flex-1 text-start z-30">
                <button
                  type="button"
                  onClick={() => {
                    setSaleOrRentalOpen(!saleOrRentalOpen);
                    setTypeDropdownOpen(false);
                  }}
                  className="w-full h-10 px-3 flex items-center justify-between bg-black/30 hover:bg-black/40 focus:bg-black/50 text-white text-xs sm:text-sm font-normal rounded-lg border border-white/50 focus:border-white focus:outline-none transition-all shadow-sm cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Home className="w-3.5 h-3.5 text-white/70 shrink-0" />
                    <span className="truncate">
                      {saleOrRental === 'sale'
                        ? isArabic
                          ? 'للبيع'
                          : 'Sale'
                        : saleOrRental === 'rental'
                        ? isArabic
                          ? 'للإيجار'
                          : 'Rental'
                        : isArabic
                        ? 'بيع أو إيجار'
                        : 'Sale or Rental'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {saleOrRental && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setSaleOrRental('');
                        }}
                        className="hover:text-red-400 p-0.5"
                      >
                        <X className="w-3 h-3 text-white/70" />
                      </span>
                    )}
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-white/70 transition-transform ${
                        saleOrRentalOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {saleOrRentalOpen && (
                  <div className="absolute top-full left-0 mt-1 w-full min-w-[180px] bg-white text-gray-800 rounded-lg shadow-2xl border border-gray-200 overflow-hidden z-50 text-xs sm:text-sm animate-in fade-in duration-100">
                    <div
                      onClick={() => {
                        setSaleOrRental('');
                        setSaleOrRentalOpen(false);
                      }}
                      className={`px-4 py-2.5 hover:bg-gray-100 cursor-pointer flex items-center justify-between transition-colors ${
                        !saleOrRental ? 'bg-red-50 text-[#c4191a] font-bold' : 'font-medium'
                      }`}
                    >
                      <span>{isArabic ? 'الكل (بيع وإيجار)' : 'All (Sale & Rental)'}</span>
                      {!saleOrRental && <Check className="w-4 h-4 text-[#c4191a]" />}
                    </div>
                    <div
                      onClick={() => {
                        setSaleOrRental('sale');
                        setSaleOrRentalOpen(false);
                      }}
                      className={`px-4 py-2.5 hover:bg-gray-100 cursor-pointer flex items-center justify-between border-t border-gray-100 transition-colors ${
                        saleOrRental === 'sale' ? 'bg-red-50 text-[#c4191a] font-bold' : 'font-medium'
                      }`}
                    >
                      <span>{isArabic ? 'بيع' : 'Sale'}</span>
                      {saleOrRental === 'sale' && <Check className="w-4 h-4 text-[#c4191a]" />}
                    </div>
                    <div
                      onClick={() => {
                        setSaleOrRental('rental');
                        setSaleOrRentalOpen(false);
                      }}
                      className={`px-4 py-2.5 hover:bg-gray-100 cursor-pointer flex items-center justify-between border-t border-gray-100 transition-colors ${
                        saleOrRental === 'rental' ? 'bg-red-50 text-[#c4191a] font-bold' : 'font-medium'
                      }`}
                    >
                      <span>{isArabic ? 'إيجار' : 'Rental'}</span>
                      {saleOrRental === 'rental' && <Check className="w-4 h-4 text-[#c4191a]" />}
                    </div>
                  </div>
                )}
              </div>

              {/* Field 4: Search Button */}
              <div className="w-full lg:w-auto shrink-0 flex justify-center">
                <button
                  id="hero-search-btn"
                  type="submit"
                  disabled={isSearching}
                  className="w-full sm:w-44 lg:w-32 xl:w-36 h-10 rounded-lg bg-[#c4191a] hover:bg-[#a51516] active:bg-[#8f1213] text-white text-xs sm:text-sm font-bold tracking-wide shadow-md transition-all flex items-center justify-center cursor-pointer select-none"
                >
                  {isSearching ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>{isArabic ? 'بحث' : 'Search'}</span>
                  )}
                </button>
              </div>
            </div>

            {/* Expandable Filter Trigger Button */}
            <div className="flex flex-col items-center pt-1">
              <button
                type="button"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`text-xs text-white/90 hover:text-white transition-all flex items-center gap-1.5 py-1 px-3.5 rounded-full border border-white/20 hover:border-white/40 cursor-pointer ${
                  showAdvancedFilters ? 'bg-black/50 border-[#c4191a]/80 shadow-md' : 'bg-black/30 hover:bg-black/40'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#c4191a]" />
                <span className="font-medium">
                  {showAdvancedFilters
                    ? isArabic
                      ? 'إخفاء الفلاتر المتقدمة'
                      : 'Hide Advanced Filters'
                    : isArabic
                    ? '+ فلاتر متقدمة (السعر، المساحة، الغرف، الطابق)'
                    : '+ More Filters (Price, Area, Beds, Floor)'}
                </span>
                {activeExtraFiltersCount > 0 && (
                  <span className="bg-[#c4191a] text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1">
                    {activeExtraFiltersCount}
                  </span>
                )}
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    showAdvancedFilters ? 'rotate-180 text-[#c4191a]' : 'text-white/70'
                  }`}
                />
              </button>

              {/* Advanced Filter Panel Structure */}
              {showAdvancedFilters && (
                <div
                  id="advanced-filter-panel"
                  className="w-full max-w-4xl mt-3 p-4 sm:p-5 rounded-2xl bg-black/75 backdrop-blur-md border border-white/20 shadow-2xl text-start text-white animate-in fade-in zoom-in-95 duration-200"
                >
                  
                  {/* Panel Header */}
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/15">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-[#c4191a]" />
                      <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                        {isArabic ? 'خيارات الفلترة التفصيلية والمتقدمة' : 'Detailed Advanced Filters'}
                      </h3>
                    </div>
                    {activeExtraFiltersCount > 0 && (
                      <button
                        type="button"
                        onClick={handleResetAdvanced}
                        className="text-[11px] text-white/70 hover:text-[#ff6b6b] flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{isArabic ? 'تفريغ الفلاتر' : 'Clear All'}</span>
                      </button>
                    )}
                  </div>

                  {/* Filter Fields Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 text-xs">
                    
                    {/* 1. Price (USD): Min & Max */}
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-white/85 font-medium text-[11px] sm:text-xs">
                        <DollarSign className="w-3.5 h-3.5 text-[#c4191a]" />
                        <span>{isArabic ? 'السعر (USD $)' : 'Price (USD $)'}</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={minPrice}
                            onChange={(e) => setMinPrice(e.target.value)}
                            placeholder={isArabic ? 'الحد الأدنى' : 'Min Price'}
                            className="w-full h-9 px-2.5 bg-black/40 hover:bg-black/55 focus:bg-black/70 text-white placeholder-white/40 text-xs rounded-lg border border-white/30 focus:border-[#c4191a] focus:outline-none transition-colors"
                          />
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={maxPrice}
                            onChange={(e) => setMaxPrice(e.target.value)}
                            placeholder={isArabic ? 'الحد الأقصى' : 'Max Price'}
                            className="w-full h-9 px-2.5 bg-black/40 hover:bg-black/55 focus:bg-black/70 text-white placeholder-white/40 text-xs rounded-lg border border-white/30 focus:border-[#c4191a] focus:outline-none transition-colors"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 2. Area (m²): Min & Max */}
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-white/85 font-medium text-[11px] sm:text-xs">
                        <Maximize2 className="w-3.5 h-3.5 text-[#c4191a]" />
                        <span>{isArabic ? 'المساحة (م²)' : 'Area (m²)'}</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={minArea}
                            onChange={(e) => setMinArea(e.target.value)}
                            placeholder={isArabic ? 'الحد الأدنى م²' : 'Min m²'}
                            className="w-full h-9 px-2.5 bg-black/40 hover:bg-black/55 focus:bg-black/70 text-white placeholder-white/40 text-xs rounded-lg border border-white/30 focus:border-[#c4191a] focus:outline-none transition-colors"
                          />
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={maxArea}
                            onChange={(e) => setMaxArea(e.target.value)}
                            placeholder={isArabic ? 'الحد الأقصى م²' : 'Max m²'}
                            className="w-full h-9 px-2.5 bg-black/40 hover:bg-black/55 focus:bg-black/70 text-white placeholder-white/40 text-xs rounded-lg border border-white/30 focus:border-[#c4191a] focus:outline-none transition-colors"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 3. Bedrooms Selector */}
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-white/85 font-medium text-[11px] sm:text-xs">
                        <Bed className="w-3.5 h-3.5 text-[#c4191a]" />
                        <span>{isArabic ? 'غرف النوم' : 'Bedrooms'}</span>
                      </label>
                      <div className="flex items-center gap-1">
                        {['', '1', '2', '3', '4', '5+'].map((b) => {
                          const isSelected = bedrooms === b;
                          const label = b === '' ? (isArabic ? 'الكل' : 'Any') : b;
                          return (
                            <button
                              key={b || 'any'}
                              type="button"
                              onClick={() => setBedrooms(isSelected ? '' : b)}
                              className={`flex-1 h-9 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                                isSelected
                                  ? 'bg-[#c4191a] border-[#c4191a] text-white shadow-sm'
                                  : 'bg-black/40 border-white/30 text-white/80 hover:bg-black/60 hover:text-white'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 4. Bathrooms Selector */}
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-white/85 font-medium text-[11px] sm:text-xs">
                        <Bath className="w-3.5 h-3.5 text-[#c4191a]" />
                        <span>{isArabic ? 'الحمامات' : 'Bathrooms'}</span>
                      </label>
                      <div className="flex items-center gap-1">
                        {['', '1', '2', '3', '4+'].map((b) => {
                          const isSelected = bathrooms === b;
                          const label = b === '' ? (isArabic ? 'الكل' : 'Any') : b;
                          return (
                            <button
                              key={b || 'any'}
                              type="button"
                              onClick={() => setBathrooms(isSelected ? '' : b)}
                              className={`flex-1 h-9 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                                isSelected
                                  ? 'bg-[#c4191a] border-[#c4191a] text-white shadow-sm'
                                  : 'bg-black/40 border-white/30 text-white/80 hover:bg-black/60 hover:text-white'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 5. Floor Selector */}
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-white/85 font-medium text-[11px] sm:text-xs">
                        <Layers className="w-3.5 h-3.5 text-[#c4191a]" />
                        <span>{isArabic ? 'الطابق' : 'Floor'}</span>
                      </label>
                      <div className="relative">
                        <select
                          value={floor}
                          onChange={(e) => setFloor(e.target.value)}
                          className="w-full h-9 px-3 bg-black/40 hover:bg-black/55 focus:bg-black/70 text-white text-xs rounded-lg border border-white/30 focus:border-[#c4191a] focus:outline-none appearance-none cursor-pointer"
                        >
                          <option value="" className="bg-[#1a1b1d] text-white">
                            {isArabic ? 'أي طابق' : 'Any Floor'}
                          </option>
                          <option value="ground" className="bg-[#1a1b1d] text-white">
                            {isArabic ? 'طابق أرضي (Ground Floor)' : 'Ground Floor'}
                          </option>
                          <option value="1-3" className="bg-[#1a1b1d] text-white">
                            {isArabic ? 'طوابق أولى (١ - ٣)' : '1st - 3rd Floor'}
                          </option>
                          <option value="4-7" className="bg-[#1a1b1d] text-white">
                            {isArabic ? 'طوابق متوسطة (٤ - ٧)' : '4th - 7th Floor'}
                          </option>
                          <option value="8+" className="bg-[#1a1b1d] text-white">
                            {isArabic ? 'طوابق عليا (٨ فما فوق)' : '8th+ Floor & Higher'}
                          </option>
                          <option value="penthouse" className="bg-[#1a1b1d] text-white">
                            {isArabic ? 'رووف / بنتهاوس (Penthouse/Roof)' : 'Roof / Penthouse'}
                          </option>
                        </select>
                        <div className="absolute right-2.5 rtl:right-auto rtl:left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white/60 text-[10px]">
                          ▼
                        </div>
                      </div>
                    </div>

                    {/* 6. Building Age */}
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-white/85 font-medium text-[11px] sm:text-xs">
                        <Calendar className="w-3.5 h-3.5 text-[#c4191a]" />
                        <span>{isArabic ? 'عمر البناية' : 'Building Age'}</span>
                      </label>
                      <div className="relative">
                        <select
                          value={buildingAge}
                          onChange={(e) => setBuildingAge(e.target.value)}
                          className="w-full h-9 px-3 bg-black/40 hover:bg-black/55 focus:bg-black/70 text-white text-xs rounded-lg border border-white/30 focus:border-[#c4191a] focus:outline-none appearance-none cursor-pointer"
                        >
                          {BUILDING_AGES.map((age) => (
                            <option key={age.value} value={age.value} className="bg-[#1a1b1d] text-white">
                              {isArabic ? age.labelAr : age.labelEn}
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-2.5 rtl:right-auto rtl:left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white/60 text-[10px]">
                          ▼
                        </div>
                      </div>
                    </div>

                    {/* 7. Furnishing Status */}
                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                      <label className="flex items-center gap-1.5 text-white/85 font-medium text-[11px] sm:text-xs">
                        <Armchair className="w-3.5 h-3.5 text-[#c4191a]" />
                        <span>{isArabic ? 'حالة الفرش والتأثيث' : 'Furnishing Status'}</span>
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: '', labelEn: 'All Furnishing', labelAr: 'الكل' },
                          { id: 'fully_furnished', labelEn: 'Fully Furnished', labelAr: 'مفروش بالكامل' },
                          { id: 'unfurnished', labelEn: 'Unfurnished', labelAr: 'غير مفروش' },
                          { id: 'appliances_only', labelEn: 'Appliances Only', labelAr: 'أجهزة فقط' },
                        ].map((furn) => {
                          const isSelected = furnished === furn.id;
                          return (
                            <button
                              key={furn.id || 'any'}
                              type="button"
                              onClick={() => setFurnished(isSelected ? '' : furn.id)}
                              className={`h-9 px-2 rounded-lg text-xs font-medium transition-all border truncate cursor-pointer ${
                                isSelected
                                  ? 'bg-[#c4191a] border-[#c4191a] text-white font-bold shadow-sm'
                                  : 'bg-black/40 border-white/30 text-white/80 hover:bg-black/60 hover:text-white'
                              }`}
                            >
                              {isArabic ? furn.labelAr : furn.labelEn}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons in Panel Footer */}
                  <div className="mt-5 pt-3.5 border-t border-white/15 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={handleResetAdvanced}
                      className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/85 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{isArabic ? 'مسح الفلاتر الإضافية' : 'Reset Extra Filters'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSearchSubmit()}
                      className="px-6 py-2 rounded-lg bg-[#c4191a] hover:bg-[#a51516] active:bg-[#8f1213] text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                    >
                      <Search className="w-4 h-4" />
                      <span>{isArabic ? 'تطبيق الفلاتر الآن' : 'Apply Filters Now'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};
