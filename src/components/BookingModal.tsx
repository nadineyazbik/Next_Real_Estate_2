import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  Phone,
  User,
  Building2,
  CheckCircle2,
  Star,
  ExternalLink,
  MessageCircle,
  FileText,
} from 'lucide-react';
import { Property, Language } from '../types';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  property?: Property | null;
  lang?: Language;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  property,
  lang = 'en',
}) => {
  const isArabic = lang === 'ar';

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [appointmentTime, setAppointmentTime] = useState('11:00 AM');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<{
    bookingId: string;
    ownerWhatsAppUrl: string;
    clientWhatsAppUrl: string;
    googleReviewUrl: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/agent/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientPhone: clientPhone.trim(),
          appointmentDate,
          appointmentTime,
          propertyId: property?.id,
          propertyTitle: property ? (isArabic ? property.titleAr : property.title) : undefined,
          referenceNo: property?.referenceNo,
          notes: notes.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setBookingResult({
          bookingId: data.bookingId,
          ownerWhatsAppUrl: data.ownerWhatsAppUrl,
          clientWhatsAppUrl: data.clientWhatsAppUrl,
          googleReviewUrl: data.googleReviewUrl || 'https://g.page/r/next-real-estate-lebanon/review',
        });
      }
    } catch (err) {
      console.error('Error submitting booking:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const timeSlots = [
    '09:00 AM',
    '10:00 AM',
    '11:00 AM',
    '12:00 PM',
    '02:00 PM',
    '03:00 PM',
    '04:00 PM',
    '05:00 PM',
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-[#0b3c35] text-white p-4 sm:p-5 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3
                className="text-base sm:text-lg font-bold leading-tight"
                style={{ fontFamily: isArabic ? "'Cairo', sans-serif" : "'Prompt', sans-serif" }}
              >
                {isArabic ? 'حجز موعد معاينة عقارية' : 'Book a Property Viewing'}
              </h3>
              <p className="text-xs text-emerald-100/80">
                {isArabic
                  ? 'تأكيد فوري وإشعار تلقائي عبر واتساب • هاتف 76743414'
                  : 'Instant confirmation & WhatsApp notification • +961 76 743 414'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title={isArabic ? 'إغلاق' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto">
          {bookingResult ? (
            /* Confirmation State */
            <div className="text-center py-2 space-y-4 animate-in fade-in">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-500 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <span className="inline-block bg-emerald-100 text-emerald-800 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full mb-1">
                  {bookingResult.bookingId}
                </span>
                <h4
                  className="text-lg sm:text-xl font-bold text-gray-900"
                  style={{ fontFamily: isArabic ? "'Cairo', sans-serif" : "'Prompt', sans-serif" }}
                >
                  {isArabic ? 'تم تأكيد طلب المعاينة بنجاح!' : 'Viewing Request Confirmed!'}
                </h4>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  {isArabic
                    ? 'تم تسجيل الموعد وإرسال إشعار فوري لإدارة Next Real Estate على الرقم +961 76 743 414.'
                    : 'Your viewing has been recorded and an instant notification was dispatched to Next Real Estate (+961 76 743 414).'}
                </p>
              </div>

              {/* WhatsApp Action Buttons */}
              <div className="space-y-2 pt-2">
                <a
                  href={bookingResult.ownerWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#25D366] hover:bg-[#20ba59] active:scale-[0.99] text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm transition shadow-sm"
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
                  <span>
                    {isArabic
                      ? 'إرسال التفاصيل مباشرة للإدارة عبر واتساب'
                      : 'Send Details to Owner via WhatsApp (+961 76 743 414)'}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                {bookingResult.clientWhatsAppUrl && (
                  <a
                    href={bookingResult.clientWhatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 font-semibold py-2 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition"
                  >
                    <span>
                      {isArabic ? 'فتح رسالة التأكيد الخاصة بالزبون' : 'Open Client Confirmation WhatsApp'}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Google Review Call to Action Card */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 text-center space-y-2 mt-4">
                <div className="flex items-center justify-center gap-1 text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                  <span className="text-xs font-bold text-gray-800 ml-1.5">5.0</span>
                </div>
                <p className="text-xs text-gray-700 font-medium">
                  {isArabic
                    ? 'رأيك يهمنا دائماً! ساعد الآخرين بمشاركة تجربتك مع Next Real Estate على Google.'
                    : 'We value your feedback! Share your experience with Next Real Estate on Google Reviews.'}
                </p>
                <a
                  href={bookingResult.googleReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-white hover:bg-amber-100/50 text-gray-900 font-bold border border-gray-300 px-4 py-2 rounded-xl text-xs transition shadow-xs"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{isArabic ? 'أضف تقييمك على Google' : 'Leave a Google Review'}</span>
                  <ExternalLink className="w-3 h-3 text-gray-500" />
                </a>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 cursor-pointer"
              >
                {isArabic ? 'إغلاق النافذة' : 'Close Window'}
              </button>
            </div>
          ) : (
            /* Booking Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Selected Property preview if any */}
              {property && (
                <div className="flex items-center gap-3 p-3 bg-emerald-50/50 rounded-xl border border-emerald-200">
                  <img
                    src={property.imageUrl}
                    alt={isArabic ? property.titleAr : property.title}
                    className="w-14 h-14 rounded-lg object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0 text-start">
                    <span className="text-[11px] font-mono font-bold text-emerald-800 block truncate">
                      REF: {property.referenceNo}
                    </span>
                    <h5 className="text-xs font-bold text-gray-900 truncate">
                      {isArabic ? property.titleAr : property.title}
                    </h5>
                    <span className="text-xs font-bold text-[#c4191a]">
                      ${new Intl.NumberFormat('en-US').format(property.price)}{' '}
                      <span className="text-[10px] text-gray-500 font-normal">
                        • {isArabic ? property.locationAr : property.location}
                      </span>
                    </span>
                  </div>
                </div>
              )}

              {/* Client Full Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isArabic ? 'الاسم الكامل *' : 'Full Name *'}
                </label>
                <div className="relative">
                  <User className="absolute left-3 rtl:left-auto rtl:right-3 top-3 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder={isArabic ? 'مثال: كريم حيدر' : 'e.g. Karim Haidar'}
                    className="w-full pl-9 rtl:pl-3 rtl:pr-9 pr-3 py-2.5 rounded-xl border border-gray-300 text-xs sm:text-sm focus:outline-none focus:border-[#0b3c35] focus:ring-1 focus:ring-[#0b3c35]"
                  />
                </div>
              </div>

              {/* Client Phone Number */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isArabic ? 'رقم الهاتف / واتساب *' : 'Phone / WhatsApp *'}
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 rtl:left-auto rtl:right-3 top-3 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    required
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="+961 76 743 414"
                    className="w-full pl-9 rtl:pl-3 rtl:pr-9 pr-3 py-2.5 rounded-xl border border-gray-300 text-xs sm:text-sm focus:outline-none focus:border-[#0b3c35] focus:ring-1 focus:ring-[#0b3c35]"
                  />
                </div>
              </div>

              {/* Date & Time selection in 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Appointment Date */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isArabic ? 'تاريخ المعاينة المفضل *' : 'Preferred Date *'}
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 rtl:left-auto rtl:right-3 top-3 w-4 h-4 text-gray-400" />
                    <input
                      type="date"
                      required
                      value={appointmentDate}
                      onChange={(e) => setAppointmentDate(e.target.value)}
                      className="w-full pl-9 rtl:pl-3 rtl:pr-9 pr-3 py-2.5 rounded-xl border border-gray-300 text-xs sm:text-sm focus:outline-none focus:border-[#0b3c35]"
                    />
                  </div>
                </div>

                {/* Appointment Time */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isArabic ? 'الوقت المناسب *' : 'Preferred Time *'}
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 rtl:left-auto rtl:right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
                    <select
                      value={appointmentTime}
                      onChange={(e) => setAppointmentTime(e.target.value)}
                      className="w-full pl-9 rtl:pl-3 rtl:pr-9 pr-3 py-2.5 rounded-xl border border-gray-300 text-xs sm:text-sm focus:outline-none focus:border-[#0b3c35] bg-white cursor-pointer"
                    >
                      {timeSlots.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isArabic ? 'ملاحظات إضافية (اختياري)' : 'Additional Notes (Optional)'}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    isArabic
                      ? 'هل تفضل المعاينة صباحاً أو برفقة عائلتك؟'
                      : 'Any specific questions or preferences for the viewing?'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs sm:text-sm focus:outline-none focus:border-[#0b3c35]"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#0b3c35] hover:bg-[#072823] active:scale-[0.99] text-white font-bold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Calendar className="w-4 h-4 text-emerald-300" />
                    <span>{isArabic ? 'تأكيد حجز المعاينة' : 'Confirm Viewing Appointment'}</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-gray-500 text-center">
                {isArabic
                  ? 'سيتم إشعار الإدارة فورياً عبر واتساب (+961 76 743 414) لترتيب المعاينة.'
                  : 'Management will be notified via WhatsApp (+961 76 743 414) to arrange the visit.'}
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
