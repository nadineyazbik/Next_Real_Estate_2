import React, { useState, useRef } from 'react';
import {
  X,
  CheckCircle2,
  UploadCloud,
  Building2,
  Trash2,
  AlertCircle,
  Loader2,
  DollarSign,
  Maximize2,
  Home,
  Check,
  Video,
  Send,
  Phone,
} from 'lucide-react';
import { Language } from '../types';
import { apiService } from '../services/apiService';

interface AddPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: Language;
}

const PROPERTY_TYPES_LIST = [
  { en: 'Apartment', ar: 'شقة سكنية' },
  { en: 'Commercial', ar: 'تجاري / مكاتب / محلات' },
  { en: 'Villa', ar: 'فيلا مستقلة' },
  { en: 'Land', ar: 'أرض للبيع / استثمار' },
  { en: 'House', ar: 'منزل مستقل' },
  { en: 'Chalet', ar: 'شاليه / كابينة' },
  { en: 'Building', ar: 'مبنى بالكامل' },
];

const AMENITIES_OPTIONS = [
  { id: 'parking', en: 'Covered Parking', ar: 'موقف سيارات مغطى' },
  { id: 'elevator', en: 'Elevator', ar: 'مصعد حديث' },
  { id: 'generator', en: '24/7 Generator', ar: 'مولد كهرباء 24/7' },
  { id: 'solar', en: 'Solar Power System', ar: 'طاقة شمسية' },
  { id: 'water_well', en: 'Water Well / Artisian', ar: 'بئر ماء / خزان مياه' },
  { id: 'sea_view', en: 'Sea View', ar: 'إطلالة بحرية' },
  { id: 'mountain_view', en: 'Mountain View', ar: 'إطلالة جبلية' },
  { id: 'balcony', en: 'Balcony / Terrace', ar: 'شرفة واسعة / تراس' },
  { id: 'concierge', en: 'Concierge / Security', ar: 'ناطور / حراسة أمنية' },
  { id: 'furnished', en: 'Furnished', ar: 'مفروش بالكامل' },
];

export const AddPropertyModal: React.FC<AddPropertyModalProps> = ({
  isOpen,
  onClose,
  lang = 'en',
}) => {
  const isArabic = lang === 'ar';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [listingFor, setListingFor] = useState<'Sale' | 'Rent'>('Sale');
  const [propertyType, setPropertyType] = useState('Apartment');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [price, setPrice] = useState('');
  const [negotiable, setNegotiable] = useState(false);
  const [areaSqm, setAreaSqm] = useState('');
  const [beds, setBeds] = useState('3');
  const [baths, setBaths] = useState('2');
  const [floor, setFloor] = useState('');
  const [buildingAge, setBuildingAge] = useState('0-2 Years');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([
    'Covered Parking',
    'Elevator',
  ]);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState('');

  // Submitter details
  const [role, setRole] = useState<'Owner' | 'Broker' | 'Agent'>('Owner');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [preferredContactTime, setPreferredContactTime] = useState('Anytime');
  const [consent, setConsent] = useState(false);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [generatedRefId, setGeneratedRefId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  // Toggle amenity
  const handleToggleFeature = (featureName: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(featureName) ? prev.filter((f) => f !== featureName) : [...prev, featureName]
    );
  };

  // Process selected image files into data URLs
  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSubmissionError(null);

    const remainingSlots = 10 - photos.length;
    if (remainingSlots <= 0) {
      setSubmissionError(
        isArabic
          ? 'الحد الأقصى لرفع الصور هو 10 صور فقط.'
          : 'Maximum limit of 10 photos reached.'
      );
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    filesToProcess.forEach((file) => {
      if (!file.type.startsWith('image/')) {
        setSubmissionError(
          isArabic ? 'يرجى اختيار ملفات صور صالحة فقط.' : 'Please select valid image files only.'
        );
        return;
      }
      if (file.size > 6 * 1024 * 1024) {
        setSubmissionError(
          isArabic
            ? 'حجم الصورة يتجاوز 6 ميغابايت. يرجى اختيار صور أصغر حجماً.'
            : 'Image exceeds 6MB limit. Please choose a smaller image.'
        );
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          setPhotos((prev) => {
            if (prev.length >= 10) return prev;
            return [...prev, result];
          });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);

    if (!consent) {
      setSubmissionError(
        isArabic
          ? 'يجب الموافقة على الإقرار بأنك مخول بعرض هذا العقار قبل المتابعة.'
          : 'You must confirm authorization to list this property before continuing.'
      );
      return;
    }

    if (!title.trim() || !location.trim() || !price || !fullName.trim() || !phone.trim()) {
      setSubmissionError(
        isArabic
          ? 'يرجى تعبئة كافة الحقول المطلوبة (عنوان العقار، المنطقة، السعر، الاسم، ورقم الهاتف).'
          : 'Please complete all required fields (Title, Location, Price, Full Name, and Phone).'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        title: title.trim(),
        listingFor,
        propertyType,
        location: location.trim(),
        price: Number(price) || 0,
        negotiable,
        areaSqm: Number(areaSqm) || 0,
        beds: propertyType === 'Land' ? 0 : Number(beds) || 0,
        baths: propertyType === 'Land' ? 0 : Number(baths) || 0,
        floor: floor.trim(),
        buildingAge,
        features: selectedFeatures,
        description: description.trim(),
        role,
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        preferredContactTime,
        consent: true,
        photos,
        videoUrl: videoUrl.trim(),
      };

      const result = await apiService.submitProperty(payload);

      if (result.success && result.referenceId) {
        setGeneratedRefId(result.referenceId);
      } else {
        setSubmissionError(
          result.error ||
            (isArabic
              ? 'حدث خطأ أثناء إرسال الطلب. يرجى المحاولة لاحقاً.'
              : 'Failed to submit property request. Please try again later.')
        );
      }
    } catch (err: unknown) {
      setSubmissionError(
        err instanceof Error
          ? err.message
          : isArabic
          ? 'خطأ في الاتصال بالخادم.'
          : 'Network error occurred.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // WhatsApp quick-forward message link
  const handleOpenWhatsApp = () => {
    if (!generatedRefId) return;
    const summary = encodeURIComponent(
      `Next Real Estate - Property Submission [${generatedRefId}]:\n` +
        `Name: ${fullName} (${role})\n` +
        `Phone: ${phone}\n` +
        `Title: ${title}\n` +
        `For: ${listingFor}\n` +
        `Type: ${propertyType}\n` +
        `Location: ${location}\n` +
        `Price: $${price} ${negotiable ? '(Negotiable)' : ''}\n` +
        `Area: ${areaSqm} sqm\n` +
        `Photos: ${photos.length} uploaded`
    );
    window.open(`https://wa.me/96176743414?text=${summary}`, '_blank');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-gray-100 my-6 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#18191a] text-white p-5 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#c4191a] flex items-center justify-center text-white shrink-0 shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3
                className="text-lg font-bold text-white tracking-tight"
                style={{ fontFamily: isArabic ? "'Cairo', sans-serif" : "'Prompt', sans-serif" }}
              >
                {isArabic ? 'اعرض عقارك معنا' : 'List Your Property With Us'}
              </h3>
              <p className="text-xs text-white/70">
                {isArabic
                  ? 'أرسل لنا تفاصيل عقارك وسيقوم فريقنا بمراجعتها والتواصل معك.'
                  : 'Send us your property details and our team will review it and get back to you.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title={isArabic ? 'إغلاق' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto grow">
          {generatedRefId ? (
            /* Success State */
            <div className="text-center py-6 sm:py-8 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-green-500 flex items-center justify-center mx-auto text-green-600 shadow-md">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-1">
                <span className="inline-block px-3 py-1 bg-amber-50 text-amber-800 text-xs font-bold rounded-full border border-amber-200 uppercase tracking-wide">
                  {isArabic ? 'الحالة: قيد المراجعة (Pending)' : 'Status: Pending Review'}
                </span>
                <h4
                  className="text-xl font-bold text-gray-900 mt-2"
                  style={{ fontFamily: isArabic ? "'Cairo', sans-serif" : "'Prompt', sans-serif" }}
                >
                  {isArabic
                    ? 'شكراً لك! استلمنا عقارك وسيقوم فريقنا بمراجعته والتواصل معك قريباً.'
                    : 'Thank you! We received your property. Our team will review it and contact you soon.'}
                </h4>
                <p className="text-sm text-gray-600 max-w-md mx-auto">
                  {isArabic
                    ? 'تم حفظ تفاصيل العقار بنجاح تحت المعاينة الإدارية من قبل وسطاء Next Real Estate المعتمدين.'
                    : 'Your property request has been safely filed for broker review before publication.'}
                </p>
              </div>

              {/* Reference ID card */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 max-w-sm mx-auto shadow-xs text-center">
                <div className="text-xs text-gray-500 font-medium">
                  {isArabic ? 'رقم مرجع الطلب (Reference ID)' : 'Submission Reference ID'}
                </div>
                <div className="text-xl font-mono font-bold text-[#c4191a] mt-0.5 tracking-wider">
                  {generatedRefId}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  {isArabic
                    ? 'احتفظ بهذا الرقم لأي استفسار أو مراجعة مع خدمة العملاء.'
                    : 'Keep this reference code for updates or inquiries.'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20b858] text-white text-sm font-bold shadow-md transition hover:scale-102"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {isArabic
                      ? 'إرسال التفاصيل والصور عبر الواتساب 📲'
                      : 'Send Details & Photos via WhatsApp 📲'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-semibold transition"
                >
                  {isArabic ? 'إغلاق النافذة' : 'Close'}
                </button>
              </div>
            </div>
          ) : (
            /* Submission Form */
            <form onSubmit={handleSubmit} className="space-y-5">
              {submissionError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-3 text-xs sm:text-sm animate-in fade-in">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
                  <div>
                    <span className="font-bold">
                      {isArabic ? 'تنبيه التحقق: ' : 'Validation Alert: '}
                    </span>
                    {submissionError}
                  </div>
                </div>
              )}

              {/* 1. Transaction Type Toggle: For Sale vs For Rent */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  {isArabic ? 'نوع العرض العقاري' : 'Listing Purpose'} *
                </label>
                <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setListingFor('Sale')}
                    className={`py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                      listingFor === 'Sale'
                        ? 'bg-[#c4191a] text-white shadow-xs'
                        : 'text-gray-700 hover:text-black'
                    }`}
                  >
                    {isArabic ? 'عقار للبيع (For Sale)' : 'For Sale'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setListingFor('Rent')}
                    className={`py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                      listingFor === 'Rent'
                        ? 'bg-[#c4191a] text-white shadow-xs'
                        : 'text-gray-700 hover:text-black'
                    }`}
                  >
                    {isArabic ? 'عقار للإيجار (For Rent)' : 'For Rent'}
                  </button>
                </div>
              </div>

              {/* 2. Property Type & Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    {isArabic ? 'نوع العقار' : 'Property Type'} *
                  </label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#c4191a] bg-white font-medium"
                  >
                    {PROPERTY_TYPES_LIST.map((t) => (
                      <option key={t.en} value={t.en}>
                        {isArabic ? t.ar : t.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    {isArabic ? 'المنطقة / الحي' : 'Location / District'} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      isArabic
                        ? 'مثال: بيروت - الحمراء / المتن - برمانا'
                        : 'e.g. Beirut - Hamra, or Metn - Broummana'
                    }
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#c4191a]"
                  />
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  {isArabic ? 'عنوان الإعلان أو وصف مختصر' : 'Property Headline'} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    isArabic
                      ? 'مثال: شقة حديثة 3 غرف نوم مع إطلالة مفتوحة وموقفين'
                      : 'e.g. Modern 3-Bedroom Apartment with Panoramic View & 2 Parkings'
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#c4191a]"
                />
              </div>

              {/* 3. Pricing, Area, Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    {isArabic ? 'السعر (USD)' : 'Price (USD)'} *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 pl-3 rtl:pl-0 rtl:pr-3 flex items-center text-gray-400">
                      <DollarSign className="w-4 h-4" />
                    </span>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 185000"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full pl-9 rtl:pl-3 rtl:pr-9 pr-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#c4191a] font-semibold"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 mt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={negotiable}
                      onChange={(e) => setNegotiable(e.target.checked)}
                      className="rounded text-[#c4191a] focus:ring-[#c4191a]"
                    />
                    <span className="text-[11px] text-gray-600 font-medium">
                      {isArabic ? 'قابل للتفاوض (Negotiable)' : 'Negotiable'}
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    {isArabic ? 'المساحة (م²)' : 'Area (m²)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 165"
                    value={areaSqm}
                    onChange={(e) => setAreaSqm(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#c4191a]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    {isArabic ? 'عمر البناء' : 'Building Age'}
                  </label>
                  <select
                    value={buildingAge}
                    onChange={(e) => setBuildingAge(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#c4191a] bg-white font-medium"
                  >
                    <option value="Under Construction">
                      {isArabic ? 'قيد الإنشاء (Under Construction)' : 'Under Construction'}
                    </option>
                    <option value="0-2 Years">{isArabic ? 'حديث (0-2 سنة)' : 'Brand New (0-2 Yrs)'}</option>
                    <option value="3-5 Years">{isArabic ? '3-5 سنوات' : '3-5 Years'}</option>
                    <option value="6-10 Years">{isArabic ? '6-10 سنوات' : '6-10 Years'}</option>
                    <option value="10+ Years">{isArabic ? 'أكثر من 10 سنوات' : '10+ Years'}</option>
                  </select>
                </div>
              </div>

              {/* Beds, Baths, Floor (hidden if land) */}
              {propertyType !== 'Land' && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      {isArabic ? 'غرف النوم' : 'Bedrooms'}
                    </label>
                    <select
                      value={beds}
                      onChange={(e) => setBeds(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#c4191a] bg-white"
                    >
                      <option value="0">0 (Studio)</option>
                      <option value="1">1 Bed</option>
                      <option value="2">2 Beds</option>
                      <option value="3">3 Beds</option>
                      <option value="4">4 Beds</option>
                      <option value="5">5+ Beds</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      {isArabic ? 'الحمامات' : 'Bathrooms'}
                    </label>
                    <select
                      value={baths}
                      onChange={(e) => setBaths(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#c4191a] bg-white"
                    >
                      <option value="1">1 Bath</option>
                      <option value="2">2 Baths</option>
                      <option value="3">3 Baths</option>
                      <option value="4">4+ Baths</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      {isArabic ? 'الطابق' : 'Floor'}
                    </label>
                    <input
                      type="text"
                      placeholder={isArabic ? 'مثال: 3 / رابع' : 'e.g. 3rd Floor'}
                      value={floor}
                      onChange={(e) => setFloor(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#c4191a]"
                    />
                  </div>
                </div>
              )}

              {/* 4. Amenities / Features */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  {isArabic ? 'المزايا والمرافق المتوفرة' : 'Key Amenities & Features'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {AMENITIES_OPTIONS.map((item) => {
                    const isChecked = selectedFeatures.includes(item.en);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleToggleFeature(item.en)}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-start text-xs font-medium transition cursor-pointer ${
                          isChecked
                            ? 'border-[#c4191a] bg-red-50 text-[#c4191a] font-bold'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                            isChecked
                              ? 'bg-[#c4191a] border-[#c4191a] text-white'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3" />}
                        </div>
                        <span className="truncate">{isArabic ? item.ar : item.en}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. Detailed Description */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  {isArabic ? 'تفاصيل إضافية عن العقار' : 'Detailed Description'}
                </label>
                <textarea
                  rows={3}
                  placeholder={
                    isArabic
                      ? 'اذكر أية تفاصيل مهمة: حالة العقار، شروط الدفع، سند الملكية (طابو 2400 سهم)، قرب الخدمات...'
                      : 'Mention condition, title deed details (2400 shares), payment terms, view, surroundings...'
                  }
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#c4191a]"
                />
              </div>

              {/* 6. Multi-Photo Upload & Preview Zone */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    {isArabic ? 'صور العقار' : 'Property Photos'} (Max 10)
                  </label>
                  <span className="text-[11px] font-semibold text-gray-500">
                    {photos.length} / 10 {isArabic ? 'صور مختارة' : 'photos'}
                  </span>
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFiles(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-[#c4191a] bg-red-50/50'
                      : 'border-gray-300 hover:border-gray-400 bg-gray-50/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleFiles(e.target.files)}
                    className="hidden"
                  />
                  <UploadCloud className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                  <p className="text-xs sm:text-sm font-semibold text-gray-700">
                    {isArabic
                      ? 'انقر لرفع الصور أو اسحبها إلى هنا'
                      : 'Click to upload photos or drag and drop'}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {isArabic ? 'PNG, JPG, WEBP حتى 6 ميغابايت لكل صورة' : 'PNG, JPG, WEBP up to 6MB each'}
                  </p>
                </div>

                {/* Thumbnails Grid */}
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-3">
                    {photos.map((src, idx) => (
                      <div
                        key={idx}
                        className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-100 shadow-xs"
                      >
                        <img
                          src={src}
                          alt={`Uploaded preview ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemovePhoto(idx);
                          }}
                          className="absolute top-1 right-1 rtl:right-auto rtl:left-1 w-6 h-6 rounded-full bg-black/70 hover:bg-[#c4191a] text-white flex items-center justify-center transition shadow-sm opacity-90 group-hover:opacity-100"
                          title={isArabic ? 'حذف الصورة' : 'Remove photo'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {idx === 0 && (
                          <span className="absolute bottom-1 left-1 rtl:left-auto rtl:right-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                            {isArabic ? 'الرئيسية' : 'Cover'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Optional Video Link */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  {isArabic ? 'رابط فيديو أو جولة افتراضية (اختياري)' : 'Video Tour Link (Optional)'}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 pl-3 rtl:pl-0 rtl:pr-3 flex items-center text-gray-400">
                    <Video className="w-4 h-4" />
                  </span>
                  <input
                    type="url"
                    placeholder="https://youtu.be/... or Google Drive link"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    className="w-full pl-9 rtl:pl-3 rtl:pr-9 pr-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#c4191a]"
                  />
                </div>
              </div>

              {/* 7. Submitter Contact Information */}
              <div className="pt-3 border-t border-gray-200 space-y-3">
                <h4
                  className="text-xs font-bold text-gray-900 uppercase tracking-wider"
                  style={{ fontFamily: isArabic ? "'Cairo', sans-serif" : "'Prompt', sans-serif" }}
                >
                  {isArabic ? 'بيانات التواصل لصاحب الطلب' : 'Submitter Contact Information'}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {isArabic ? 'صفة مقدم الطلب' : 'Your Role'} *
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#c4191a] bg-white font-medium"
                    >
                      <option value="Owner">{isArabic ? 'المالك المباشر' : 'Direct Owner'}</option>
                      <option value="Broker">{isArabic ? 'وسيط عقاري' : 'Real Estate Broker'}</option>
                      <option value="Agent">{isArabic ? 'وكيل مفوض' : 'Authorized Agent'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {isArabic ? 'الاسم الكامل' : 'Full Name'} *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={isArabic ? 'مثال: سامي خوري' : 'e.g. Sami Khoury'}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#c4191a]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {isArabic ? 'رقم الهاتف / واتساب' : 'Phone / WhatsApp'} *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+961 70 123 456"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#c4191a]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {isArabic ? 'البريد الإلكتروني (اختياري)' : 'Email (Optional)'}
                    </label>
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#c4191a]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {isArabic ? 'وقت الاتصال المفضل' : 'Preferred Contact Time'}
                    </label>
                    <select
                      value={preferredContactTime}
                      onChange={(e) => setPreferredContactTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#c4191a] bg-white"
                    >
                      <option value="Anytime">{isArabic ? 'في أي وقت' : 'Anytime'}</option>
                      <option value="Morning (9am - 12pm)">
                        {isArabic ? 'صباحاً (9ص - 12ظ)' : 'Morning (9am - 12pm)'}
                      </option>
                      <option value="Afternoon (12pm - 5pm)">
                        {isArabic ? 'بعد الظهر (12ظ - 5م)' : 'Afternoon (12pm - 5pm)'}
                      </option>
                      <option value="Evening (5pm - 8pm)">
                        {isArabic ? 'مساءً (5م - 8م)' : 'Evening (5pm - 8pm)'}
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 8. Mandatory Authorization Consent */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 rounded text-[#c4191a] focus:ring-[#c4191a] w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs text-amber-950 font-medium leading-relaxed">
                    {isArabic
                      ? 'أقر بأنني مخول قانونياً بعرض هذا العقار، وأن جميع البيانات والصور المرفقة صحيحة ودقيقة، وأوافق على تواصل فريق Next Real Estate معي لمراجعة العرض.'
                      : 'I confirm that I am legally authorized to list this property, that all details and photos are accurate, and I agree to be contacted by Next Real Estate brokers to review this listing.'}
                  </span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-semibold transition"
                >
                  {isArabic ? 'إلغاء' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !consent}
                  className="inline-flex items-center justify-center gap-2 px-7 py-2.5 rounded-xl bg-[#c4191a] hover:bg-[#a51516] active:bg-[#8f1213] text-white text-sm font-bold shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isArabic ? 'جارٍ الإرسال للمراجعة...' : 'Sending For Review...'}</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>{isArabic ? 'إرسال للمراجعة' : 'Send For Review'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
