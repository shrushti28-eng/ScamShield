import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  MessageSquareText,
  IndianRupee,
  Link2,
  Loader2,
  RotateCcw,
  ExternalLink,
  Globe,
  PhoneCall,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Share2,
  Sun,
  Moon,
  Sparkles,
  Clock,
  BarChart3,
  Eye,
  LogIn,
  LogOut,
  User,
  FileWarning,
  X,
} from 'lucide-react';
import {
  analyzeMessage,
  analyzeCollectRequest,
  analyzeLinks,
  findHighlightSegments,
  buildShareSummary,
  maskSensitiveText,
} from './rules.js';

type TabId = 'message' | 'collect' | 'link';
type Language = 'en' | 'hi';
type Verdict = 'Safe' | 'Suspicious' | 'Dangerous';

interface FlagItem {
  id: string;
  points: number;
  percentage?: number;
  reason: string;
  isGood: boolean;
}

interface UrlInspection {
  url: string;
  domain: string;
  rawPoints: number;
  flags: FlagItem[];
}

interface ScoreBreakdown {
  messagePoints: number;
  collectPoints: number;
  linkPoints: number;
}

interface AnalysisResult {
  tab: TabId;
  inputText: string;
  score: number;
  verdict: Verdict;
  flags: FlagItem[];
  isCollectRequest: boolean;
  primaryDomain: string;
  urls: UrlInspection[];
  breakdown: ScoreBreakdown;
}

interface RecentCheck {
  verdict: Verdict;
  score: number;
  timestamp: number;
}

interface Stats {
  total: number;
  dangerous: number;
  recent: RecentCheck[];
}

interface HighlightSegment {
  text: string;
  highlight: boolean;
  isGood?: boolean;
  reason?: string;
  points?: number;
}

const SAMPLES: Array<{
  id: string;
  label: string;
  labelHi: string;
  targetTab: TabId;
  text: string;
}> = [
  {
    id: 'sbi_kyc',
    label: 'Fake SBI KYC SMS',
    labelHi: 'नकली SBI KYC SMS',
    targetTab: 'message',
    text: 'Dear Customer, your SBI YONO account will be blocked today. Update KYC immediately at http://sbi-kyc-update.xyz/login',
  },
  {
    id: 'upi_collect',
    label: 'UPI Collect Scam',
    labelHi: 'UPI कलेक्ट स्कैम',
    targetTab: 'collect',
    text: 'You won cashback of Rs 5000. Approve the collect request and enter your UPI PIN to receive the money',
  },
  {
    id: 'digital_arrest',
    label: 'Digital Arrest + AnyDesk',
    labelHi: 'डिजिटल अरेस्ट + AnyDesk',
    targetTab: 'message',
    text: 'CBI Cyber Cell: Digital arrest warrant issued for narcotics parcel at Mumbai Customs. Stay on the call, do not disconnect or tell anyone. Download AnyDesk via bit.ly/cbi-verify-case',
  },
  {
    id: 'hdfc_otp',
    label: 'Genuine HDFC OTP',
    labelHi: 'असली HDFC OTP',
    targetTab: 'message',
    text: 'HDFC Bank: 482910 is your OTP for Rs 1,250.00 card txn at Swiggy. Valid for 10 mins. Do not share this OTP with anyone.',
  },
];

const SCAN_STEPS = [
  { id: 'read', labelEn: 'Reading message', labelHi: 'संदेश पढ़ा जा रहा है' },
  { id: 'links', labelEn: 'Checking links', labelHi: 'लिंक और पैटर्न जाँचे जा रहे हैं' },
  { id: 'ai', labelEn: 'Asking AI', labelHi: 'AI से व्याख्या ली जा रही है' },
];

const VERDICT_CONFIG: Record<
  Verdict,
  {
    emoji: string;
    labelEn: string;
    labelHi: string;
    cardBg: string;
    border: string;
    text: string;
    barColor: string;
    strokeColor: string;
    scoreColor: string;
  }
> = {
  Safe: {
    emoji: '✅',
    labelEn: 'Safe',
    labelHi: 'सुरक्षित',
    cardBg:
      'bg-emerald-50/90 dark:bg-emerald-950/35 shadow-[0_0_32px_-8px_rgba(16,185,129,0.35)] dark:shadow-[0_0_36px_-8px_rgba(16,185,129,0.28)]',
    border: 'border-emerald-200 dark:border-emerald-800/80',
    text: 'text-emerald-950 dark:text-emerald-100',
    barColor: 'bg-emerald-600 dark:bg-emerald-500',
    strokeColor: '#16a34a',
    scoreColor: 'text-emerald-700 dark:text-emerald-300',
  },
  Suspicious: {
    emoji: '⚠️',
    labelEn: 'Suspicious',
    labelHi: 'संदिग्ध',
    cardBg: 'bg-amber-50/90 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800/80',
    text: 'text-amber-950 dark:text-amber-100',
    barColor: 'bg-amber-500',
    strokeColor: '#d97706',
    scoreColor: 'text-amber-700 dark:text-amber-300',
  },
  Dangerous: {
    emoji: '🚨',
    labelEn: 'Dangerous',
    labelHi: 'खतरनाक',
    cardBg: 'bg-red-50/90 dark:bg-red-950/35',
    border: 'border-red-300 dark:border-red-800',
    text: 'text-red-950 dark:text-red-100',
    barColor: 'bg-red-600 dark:bg-red-500',
    strokeColor: '#dc2626',
    scoreColor: 'text-red-700 dark:text-red-300',
  },
};

function formatTimeAgo(timestamp: number, isHindi: boolean): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return isHindi ? 'अभी' : 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return isHindi ? `${diffMin} मि पहले` : `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return isHindi ? `${diffHr} घं पहले` : `${diffHr}h ago`;
}

function renderFormattedExplanation(rawText: string) {
  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="space-y-2.5 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
      {lines.map((line, index) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return (
            <p
              key={index}
              className="text-base font-bold text-slate-900 dark:text-white leading-snug"
            >
              {line.slice(2, -2)}
            </p>
          );
        }

        if (/^(what to do:|क्या करें:)/i.test(line)) {
          return (
            <p
              key={index}
              className="pt-2 text-sm font-bold tracking-tight text-slate-900 dark:text-white"
            >
              {line}
            </p>
          );
        }

        if (/^[-•*]\s+/.test(line)) {
          const content = line
            .replace(/^[-•*]\s+/, '')
            .replace(/\*\*(.*?)\*\*/g, '$1');
          return (
            <div key={index} className="flex items-start gap-2.5">
              <span
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500 dark:bg-indigo-400"
                aria-hidden="true"
              />
              <span>{content}</span>
            </div>
          );
        }

        const cleaned = line.replace(/\*\*(.*?)\*\*/g, '$1');
        return <p key={index}>{cleaned}</p>;
      })}
    </div>
  );
}

function SemiGauge({
  score,
  strokeColor,
}: {
  score: number;
  strokeColor: string;
}) {
  const radius = 44;
  const circumference = Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative w-28 h-16 flex items-end justify-center shrink-0">
      <svg
        viewBox="0 0 110 62"
        className="w-full h-full overflow-visible"
        aria-hidden="true"
      >
        <path
          d="M 11 54 A 44 44 0 0 1 99 54"
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          className="text-slate-200 dark:text-slate-800"
        />
        <motion.path
          d="M 11 54 A 44 44 0 0 1 99 54"
          fill="none"
          stroke={strokeColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute bottom-0 text-center leading-none">
        <span className="font-mono text-xl font-extrabold tabular-nums text-slate-900 dark:text-white">
          {score}
        </span>
        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
          /100
        </span>
      </div>
    </div>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('scamshield-theme') === 'dark';
  });
  const [activeTab, setActiveTab] = useState<TabId>('message');
  const [language, setLanguage] = useState<Language>('en');
  const [inputs, setInputs] = useState<Record<TabId, string>>({
    message: '',
    collect: '',
    link: '',
  });

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStepIndex, setScanStepIndex] = useState<number>(0);

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [displayScore, setDisplayScore] = useState<number>(0);
  const [explanation, setExplanation] = useState<string>('');
  const [isExplaining, setIsExplaining] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeHighlightIdx, setActiveHighlightIdx] = useState<number | null>(
    null
  );

  const [stats, setStats] = useState<Stats>({
    total: 0,
    dangerous: 0,
    recent: [],
  });

  const [activeSidebarSection, setActiveSidebarSection] = useState<
    'login' | 'profile' | 'checks' | 'reports' | null
  >(null);
  const [userProfile, setUserProfile] = useState<{
    name: string;
    email: string;
  } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('scamshield-user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loginName, setLoginName] = useState('');
  const [loginEmail, setLoginEmail] = useState('');

  const scanTimerRef = useRef<number[]>([]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('scamshield-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    fetch('/api/stats')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.total === 'number') {
          setStats({
            total: data.total,
            dangerous: data.dangerous || 0,
            recent: Array.isArray(data.recent) ? data.recent : [],
          });
        }
      })
      .catch(() => {});

    return () => {
      scanTimerRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  // Count risk score smoothly from 0 to final score when result appears
  useEffect(() => {
    if (!result) {
      setDisplayScore(0);
      return;
    }

    const target = result.score;
    const duration = 700;
    const startTime = performance.now();
    let rafId = 0;

    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(target * eased));
      if (progress < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [result]);

  async function fetchExplanation(
    analysis: AnalysisResult,
    targetLanguage: Language
  ) {
    setIsExplaining(true);
    try {
      const maskedText = maskSensitiveText(analysis.inputText);
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maskedText,
          verdict: analysis.verdict,
          score: analysis.score,
          flags: analysis.flags,
          language: targetLanguage,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch explanation');
      }
      const data = await response.json();
      setExplanation(data.explanation || '');
    } catch {
      setExplanation(
        targetLanguage === 'hi'
          ? '**निर्णय सहायता उपलब्ध नहीं हो सकी**\n- कृपया ऊपर दिखाए गए जोखिम संकेतों और स्कोर की जांच करें।\n- किसी भी अनजान लिंक पर क्लिक न करें और न ही OTP या UPI PIN साझा करें।\n- किसी संदिग्ध गतिविधि की सूचना 1930 या cybercrime.gov.in पर दें।\n\nWhat to do:\n- अनजान लिंक न खोलें।\n- भेजने वाले को ब्लॉक करें।\n- 1930 पर कॉल करें या cybercrime.gov.in पर शिकायत दर्ज करें।'
          : '**Explanation temporarily unavailable**\n- Review the risk score and red-flag chips shown beside this panel.\n- Treat urgent demands, unknown links, or UPI PIN prompts with caution.\n- Never share OTP, CVV, or UPI PIN to claim money or unblock accounts.\n\nWhat to do:\n- Do not click any link or approve unknown requests.\n- Block the sender immediately.\n- Report at 1930 or cybercrime.gov.in.'
      );
    } finally {
      setIsExplaining(false);
    }
  }

  async function recordCheck(verdict: Verdict, score: number) {
    try {
      const res = await fetch('/api/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict, score }),
      });
      if (res.ok) {
        const updated = await res.json();
        setStats({
          total: updated.total ?? stats.total + 1,
          dangerous: updated.dangerous ?? stats.dangerous,
          recent: Array.isArray(updated.recent) ? updated.recent : stats.recent,
        });
      }
    } catch {
      setStats((prev) => ({
        total: prev.total + 1,
        dangerous: prev.dangerous + (verdict === 'Dangerous' ? 1 : 0),
        recent: [
          { verdict, score, timestamp: Date.now() },
          ...prev.recent.slice(0, 4),
        ],
      }));
    }
  }

  function handleLanguageSwitch(nextLang: Language) {
    if (nextLang === language) return;
    setLanguage(nextLang);
    if (result) {
      void fetchExplanation(result, nextLang);
    }
  }

  function clearPendingScan() {
    scanTimerRef.current.forEach((id) => window.clearTimeout(id));
    scanTimerRef.current = [];
    setIsScanning(false);
    setScanStepIndex(0);
  }

  function handleTabChange(nextTab: TabId) {
    clearPendingScan();
    setActiveTab(nextTab);
    setResult(null);
    setExplanation('');
    setActiveHighlightIdx(null);
    setCopied(false);
  }

  function handleSampleClick(sample: (typeof SAMPLES)[number]) {
    clearPendingScan();
    let destinationTab = activeTab;
    if (activeTab === 'link') {
      destinationTab = sample.targetTab;
    } else if (activeTab === 'collect' && sample.id !== 'upi_collect') {
      destinationTab = sample.targetTab;
    }

    setActiveTab(destinationTab);
    setInputs((prev) => ({
      ...prev,
      [destinationTab]: sample.text,
    }));
    setResult(null);
    setExplanation('');
    setActiveHighlightIdx(null);
    setCopied(false);
  }

  function handleClear() {
    clearPendingScan();
    setInputs((prev) => ({ ...prev, [activeTab]: '' }));
    setResult(null);
    setExplanation('');
    setActiveHighlightIdx(null);
    setCopied(false);
  }

  function handleCheck(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const rawText = inputs[activeTab].trim();
    if (!rawText || isScanning) return;

    clearPendingScan();
    setResult(null);
    setExplanation('');
    setActiveHighlightIdx(null);
    setCopied(false);

    let analysis: AnalysisResult;
    if (activeTab === 'message') {
      const res = analyzeMessage(rawText);
      analysis = {
        tab: 'message',
        inputText: rawText,
        score: res.score,
        verdict: res.verdict as Verdict,
        flags: res.flags,
        isCollectRequest: res.isCollectRequest,
        primaryDomain: res.primaryDomain,
        urls: res.urls,
        breakdown: res.breakdown,
      };
    } else if (activeTab === 'collect') {
      const res = analyzeCollectRequest(rawText);
      analysis = {
        tab: 'collect',
        inputText: rawText,
        score: res.score,
        verdict: res.verdict as Verdict,
        flags: res.flags,
        isCollectRequest: res.isCollectRequest,
        primaryDomain: '',
        urls: [],
        breakdown: res.breakdown,
      };
    } else {
      const res = analyzeLinks(rawText);
      analysis = {
        tab: 'link',
        inputText: rawText,
        score: res.score,
        verdict: res.verdict as Verdict,
        flags: res.flags,
        isCollectRequest: false,
        primaryDomain: res.primaryDomain,
        urls: res.urls,
        breakdown: res.breakdown,
      };
    }

    // Start 1.5s Scanning sequence while calling backend in parallel
    setIsScanning(true);
    setScanStepIndex(0);
    void recordCheck(analysis.verdict, analysis.score);
    void fetchExplanation(analysis, language);

    const t1 = window.setTimeout(() => setScanStepIndex(1), 500);
    const t2 = window.setTimeout(() => setScanStepIndex(2), 1000);
    const t3 = window.setTimeout(() => {
      setIsScanning(false);
      setResult(analysis);
    }, 1500);

    scanTimerRef.current = [t1, t2, t3];
  }

  async function handleCopyWarning() {
    if (!result) return;
    const summary = buildShareSummary(result);
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy via temporary textarea
      const el = document.createElement('textarea');
      el.value = summary;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  const highlightSegments: HighlightSegment[] = useMemo(() => {
    if (!result) return [];
    return findHighlightSegments(result.inputText, result.tab);
  }, [result]);

  const shareUrl = useMemo(() => {
    if (!result) return 'https://wa.me/';
    const summary = buildShareSummary(result);
    return `https://wa.me/?text=${encodeURIComponent(summary)}`;
  }, [result]);

  const currentInput = inputs[activeTab];
  const isHindi = language === 'hi';

  const tabMeta: Record<
    TabId,
    {
      label: string;
      labelHi: string;
      icon: React.ReactNode;
      heading: string;
      headingHi: string;
      placeholder: string;
      placeholderHi: string;
    }
  > = {
    message: {
      label: 'Message Checker',
      labelHi: 'मैसेज चेकर',
      icon: <MessageSquareText className="h-4 w-4 shrink-0" />,
      heading: 'Paste an SMS, WhatsApp, or call script',
      headingHi: 'कोई भी SMS या WhatsApp संदेश यहाँ पेस्ट करें',
      placeholder:
        'Paste suspicious SMS or WhatsApp message here (e.g. KYC update, electricity bill, parcel, or OTP)...',
      placeholderHi:
        'संदिग्ध SMS या WhatsApp संदेश यहाँ पेस्ट करें (जैसे KYC अपडेट, बिजली बिल, पार्सल, या OTP)...',
    },
    collect: {
      label: 'UPI Collect Guard',
      labelHi: 'UPI कलेक्ट गार्ड',
      icon: <IndianRupee className="h-4 w-4 shrink-0" />,
      heading: 'Paste a UPI payment or collect request',
      headingHi: 'UPI पेमेंट या कलेक्ट अनुरोध यहाँ पेस्ट करें',
      placeholder:
        'Paste the UPI request text (e.g. "Approve the collect request and enter your UPI PIN to receive cashback")...',
      placeholderHi:
        'UPI अनुरोध का टेक्स्ट यहाँ पेस्ट करें (जैसे "कैशबैक पाने के लिए कलेक्ट अनुरोध स्वीकार करें और UPI PIN डालें")...',
    },
    link: {
      label: 'Link Checker',
      labelHi: 'लिंक चेकर',
      icon: <Link2 className="h-4 w-4 shrink-0" />,
      heading: 'Paste any link or message with a URL',
      headingHi: 'कोई भी लिंक या URL वाला संदेश यहाँ पेस्ट करें',
      placeholder:
        'Paste a link like http://sbi-kyc-update.xyz/login or bit.ly/3xYz...',
      placeholderHi:
        'कोई लिंक पेस्ट करें जैसे http://sbi-kyc-update.xyz/login या bit.ly/3xYz...',
    },
  };

  const currentTabMeta = tabMeta[activeTab];
  const verdictStyle = result ? VERDICT_CONFIG[result.verdict] : null;

  const positiveFlags = result
    ? result.flags.filter((f) => !f.isGood && f.points > 0)
    : [];
  const goodFlags = result ? result.flags.filter((f) => f.isGood) : [];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Dark navy-to-purple gradient hero header */}
      <header className="bg-gradient-to-br from-[#0A0F24] via-[#171645] to-[#3B0F70] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-b border-white/10">
            <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 border border-white/15">
                <Shield className="h-5 w-5 text-violet-200" />
              </div>
              <span className="text-lg font-bold tracking-tight font-display">
                ScamShield
              </span>
            </div>

            <div className="flex items-center gap-3 sm:gap-5">
              {/* Inline counters on header */}
              <div className="hidden sm:flex items-center gap-4 text-sm text-slate-300">
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="text-slate-400">
                    {isHindi ? 'जाँचे गए:' : 'Scams checked:'}
                  </span>
                  <span className="font-mono font-semibold text-white tabular-nums">
                    {stats.total}
                  </span>
                </div>
                <span className="text-white/25" aria-hidden="true">
                  ·
                </span>
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="text-slate-400">
                    {isHindi ? 'खतरनाक:' : 'Dangerous found:'}
                  </span>
                  <span className="font-mono font-semibold text-rose-300 tabular-nums">
                    {stats.dangerous}
                  </span>
                </div>
              </div>

              {/* Dark Mode Toggle */}
              <button
                type="button"
                onClick={() => setDarkMode((prev) => !prev)}
                aria-label={
                  darkMode ? 'Switch to light mode' : 'Switch to dark mode'
                }
                title={darkMode ? 'Light mode' : 'Dark mode'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {darkMode ? (
                  <>
                    <Sun className="h-3.5 w-3.5 text-amber-300" />
                    <span className="hidden md:inline">Light</span>
                  </>
                ) : (
                  <>
                    <Moon className="h-3.5 w-3.5 text-violet-200" />
                    <span className="hidden md:inline">Dark</span>
                  </>
                )}
              </button>

              {/* Language Toggle */}
              <div
                role="group"
                aria-label="Language selector"
                className="flex items-center p-1 rounded-lg bg-white/10 border border-white/15 shrink-0"
              >
                <button
                  type="button"
                  onClick={() => handleLanguageSwitch('en')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    language === 'en'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-200 hover:text-white'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageSwitch('hi')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    language === 'hi'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-200 hover:text-white'
                  }`}
                >
                  हिंदी
                </button>
              </div>
            </div>
          </div>

          {/* Hero Banner Content */}
          <div className="py-7 sm:py-9 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 mb-2.5">
                <ShieldCheck className="h-7 w-7 text-emerald-300 shrink-0" />
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white [text-wrap:balance]">
                  {isHindi
                    ? 'क्लिक करने से पहले हर स्कैम संदेश पहचानें'
                    : 'One scam message, caught before the click.'}
                </h1>
              </div>
              <p className="text-sm sm:text-base text-indigo-100/90 leading-relaxed">
                {isHindi
                  ? 'भारतीय UPI और बैंक उपयोगकर्ताओं के लिए संदेश, कलेक्ट अनुरोध और संदिग्ध लिंक की तुरंत जांच।'
                  : 'Instant risk check for Indian SMS, WhatsApp messages, UPI collect requests, and lookalike banking links.'}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with Vertical Left Bar + Center Checker + Right Summary Column */}
      <main className="flex-1 w-full max-w-[1380px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] xl:grid-cols-[230px_1fr_290px] gap-6 items-start">
          {/* Vertical Left Bar (Login, Your Profile, Total checks, Reports) */}
          <aside
            aria-label="Vertical Navigation Bar"
            className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 space-y-2 lg:sticky lg:top-6"
          >
            <p className="px-2.5 pt-1 pb-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
              {isHindi ? 'मेनू' : 'Navigation'}
            </p>

            <nav className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() =>
                  setActiveSidebarSection((curr) =>
                    curr === 'login' ? null : 'login'
                  )
                }
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  activeSidebarSection === 'login'
                    ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 truncate">
                  <LogIn className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="truncate">
                    {userProfile
                      ? userProfile.name
                      : isHindi
                      ? 'लॉगिन'
                      : 'Login'}
                  </span>
                </span>
                {userProfile && (
                  <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 shrink-0">
                    Active
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveSidebarSection((curr) =>
                    curr === 'profile' ? null : 'profile'
                  )
                }
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  activeSidebarSection === 'profile'
                    ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent'
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <User className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
                  <span>{isHindi ? 'आपकी प्रोफ़ाइल' : 'Your Profile'}</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveSidebarSection((curr) =>
                    curr === 'checks' ? null : 'checks'
                  )
                }
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  activeSidebarSection === 'checks'
                    ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent'
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{isHindi ? 'कुल जाँच' : 'Total checks'}</span>
                </span>
                <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                  {stats.total}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveSidebarSection((curr) =>
                    curr === 'reports' ? null : 'reports'
                  )
                }
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  activeSidebarSection === 'reports'
                    ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent'
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <FileWarning className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>{isHindi ? 'रिपोर्ट' : 'Reports'}</span>
                </span>
                <span className="font-mono font-bold tabular-nums text-rose-600 dark:text-rose-400">
                  {stats.dangerous}
                </span>
              </button>
            </nav>

            {/* Expandable Inline Drawer inside Vertical Left Bar */}
            <AnimatePresence>
              {activeSidebarSection && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16 }}
                  className="mt-2 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {activeSidebarSection === 'login' &&
                        (userProfile
                          ? isHindi
                            ? 'खाता सत्र'
                            : 'Session'
                          : isHindi
                          ? 'लॉगिन'
                          : 'Sign In')}
                      {activeSidebarSection === 'profile' &&
                        (isHindi ? 'आपकी प्रोफ़ाइल' : 'Your Profile')}
                      {activeSidebarSection === 'checks' &&
                        (isHindi ? 'कुल जाँच' : 'Total Checks')}
                      {activeSidebarSection === 'reports' &&
                        (isHindi ? 'रिपोर्ट और 1930' : 'Reports & 1930')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveSidebarSection(null)}
                      aria-label="Close sidebar section"
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {activeSidebarSection === 'login' && (
                    <div>
                      {userProfile ? (
                        <div className="space-y-2.5">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {userProfile.name}
                            </p>
                            <p className="text-slate-500 dark:text-slate-400 break-all">
                              {userProfile.email}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              localStorage.removeItem('scamshield-user');
                              setUserProfile(null);
                              setActiveSidebarSection(null);
                            }}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors cursor-pointer"
                          >
                            <LogOut className="h-3.5 w-3.5" />
                            <span>{isHindi ? 'लॉग आउट' : 'Sign out'}</span>
                          </button>
                        </div>
                      ) : (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const next = {
                              name: loginName.trim() || 'Citizen User',
                              email:
                                loginEmail.trim() || 'citizen@scamshield.in',
                            };
                            localStorage.setItem(
                              'scamshield-user',
                              JSON.stringify(next)
                            );
                            setUserProfile(next);
                            setLoginName('');
                            setLoginEmail('');
                            setActiveSidebarSection('profile');
                          }}
                          className="space-y-2"
                        >
                          <input
                            type="text"
                            value={loginName}
                            onChange={(e) => setLoginName(e.target.value)}
                            placeholder={isHindi ? 'आपका नाम' : 'Your name'}
                            className="w-full rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                          />
                          <input
                            type="email"
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            placeholder={
                              isHindi ? 'ईमेल (वैकल्पिक)' : 'Email (optional)'
                            }
                            className="w-full rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            type="submit"
                            className="w-full px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors cursor-pointer"
                          >
                            {isHindi ? 'लॉगिन करें' : 'Continue'}
                          </button>
                        </form>
                      )}
                    </div>
                  )}

                  {activeSidebarSection === 'profile' && (
                    <div className="space-y-2 text-slate-600 dark:text-slate-300">
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 p-2.5">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {userProfile
                            ? userProfile.name
                            : isHindi
                            ? 'अतिथि मोड'
                            : 'Guest Mode'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {userProfile
                            ? userProfile.email
                            : 'No login required to scan'}
                        </p>
                      </div>
                      <p className="text-[11px]">
                        {isHindi ? 'भाषा:' : 'Language:'}{' '}
                        <span className="font-semibold">
                          {isHindi ? 'हिंदी' : 'English'}
                        </span>{' '}
                        · {darkMode ? 'Dark' : 'Light'}
                      </p>
                    </div>
                  )}

                  {activeSidebarSection === 'checks' && (
                    <div className="space-y-2 text-slate-600 dark:text-slate-300">
                      <div className="flex justify-between">
                        <span>{isHindi ? 'कुल जाँच:' : 'Total checks:'}</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                          {stats.total}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{isHindi ? 'खतरनाक:' : 'Dangerous:'}</span>
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                          {stats.dangerous}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {isHindi
                          ? 'केवल स्कोर और समय सहेजा जाता है।'
                          : 'Only verdict, score & timestamp stored.'}
                      </p>
                    </div>
                  )}

                  {activeSidebarSection === 'reports' && (
                    <div className="space-y-2">
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                        {isHindi
                          ? 'धोखाधड़ी की रिपोर्ट तुरंत 1930 या cybercrime.gov.in पर करें।'
                          : 'Report suspicious messages or UPI fraud immediately:'}
                      </p>
                      <a
                        href="tel:1930"
                        className="block w-full text-center px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors"
                      >
                        Call 1930
                      </a>
                      <a
                        href="https://cybercrime.gov.in"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-center px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold transition-colors"
                      >
                        cybercrime.gov.in
                      </a>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </aside>

          {/* Center Primary Checker Workspace */}
          <div className="space-y-6 min-w-0">
            {/* 3 Core Feature Tabs */}
            <nav
              aria-label="ScamShield Tools"
              className="flex items-center gap-1.5 p-1.5 bg-slate-200/80 dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-x-auto"
            >
              {(['message', 'collect', 'link'] as TabId[]).map((tabKey) => {
                const meta = tabMeta[tabKey];
                const isActive = activeTab === tabKey;
                return (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => handleTabChange(tabKey)}
                    className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {meta.icon}
                    <span>{isHindi ? meta.labelHi : meta.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Input Card */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
              <form onSubmit={handleCheck} className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <label
                    htmlFor="scam-input"
                    className="text-base font-bold text-slate-900 dark:text-white"
                  >
                    {isHindi
                      ? currentTabMeta.headingHi
                      : currentTabMeta.heading}
                  </label>
                  {currentInput && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{isHindi ? 'साफ़ करें' : 'Clear'}</span>
                    </button>
                  )}
                </div>

                <textarea
                  id="scam-input"
                  rows={4}
                  value={currentInput}
                  onChange={(e) =>
                    setInputs((prev) => ({
                      ...prev,
                      [activeTab]: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      handleCheck();
                    }
                  }}
                  placeholder={
                    isHindi
                      ? currentTabMeta.placeholderHi
                      : currentTabMeta.placeholder
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/60 px-4 py-3 text-[15px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-950 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-y"
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Four One-Click Sample Buttons */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {isHindi
                        ? 'एक क्लिक में उदाहरण आज़माएं:'
                        : 'Try a sample:'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {SAMPLES.map((sample) => (
                        <button
                          key={sample.id}
                          type="button"
                          onClick={() => handleSampleClick(sample)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:border-indigo-200 dark:hover:border-indigo-700 hover:text-indigo-900 dark:hover:text-indigo-200 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {isHindi ? sample.labelHi : sample.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!currentInput.trim() || isScanning}
                    className="inline-flex items-center justify-center gap-2 px-7 py-3 min-h-[44px] rounded-xl bg-indigo-700 hover:bg-indigo-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{isHindi ? 'जाँच जारी...' : 'Scanning...'}</span>
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4" />
                        <span>{isHindi ? 'जाँच करें' : 'Check'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </section>

            {/* 1.5s Scanning Animation Card */}
            <AnimatePresence mode="wait">
              {isScanning && (
                <motion.section
                  key="scanning-panel"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/70 p-6 space-y-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {isHindi ? 'संदेश की जाँच हो रही है...' : 'Scanning...'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {isHindi
                            ? 'नियम इंजन और लिंक सुरक्षा विश्लेषण'
                            : 'Running rule engine, link checks, and AI explanation'}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-semibold text-indigo-700 dark:text-indigo-300 tabular-nums">
                      {Math.min(100, (scanStepIndex + 1) * 33)}%
                    </span>
                  </div>

                  {/* Progress Shimmer Bar */}
                  <div className="relative h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <motion.div
                      initial={{ scaleX: 0.08 }}
                      animate={{
                        scaleX:
                          scanStepIndex === 0
                            ? 0.35
                            : scanStepIndex === 1
                            ? 0.72
                            : 1,
                      }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full w-full origin-left rounded-full bg-gradient-to-r from-indigo-600 via-violet-500 to-indigo-600 relative overflow-hidden"
                    >
                      <div className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                    </motion.div>
                  </div>

                  {/* 3 Step Sequence */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {SCAN_STEPS.map((step, idx) => {
                      const isDone = idx < scanStepIndex;
                      const isCurrent = idx === scanStepIndex;
                      return (
                        <div
                          key={step.id}
                          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                            isCurrent
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200'
                              : isDone
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                              : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          ) : isCurrent ? (
                            <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
                          ) : (
                            <Clock className="h-4 w-4 shrink-0" />
                          )}
                          <span>{isHindi ? step.labelHi : step.labelEn}</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {/* Results Section */}
            <AnimatePresence mode="wait">
              {!isScanning && result && verdictStyle && (
                <motion.div
                  key={`${result.tab}-${result.score}-${result.inputText.slice(0, 20)}`}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-5"
                >
                  {/* Big Red UPI Collect Guard Warning Banner */}
                  {result.isCollectRequest && (
                    <div
                      role="alert"
                      className="rounded-2xl bg-red-600 text-white border border-red-700 p-5 sm:p-6 flex items-start gap-4"
                    >
                      <ShieldAlert className="h-8 w-8 shrink-0 text-red-100 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-lg sm:text-xl font-extrabold tracking-tight leading-snug">
                          This request TAKES money from you. You never need your
                          PIN to receive money. Decline it.
                        </p>
                        {isHindi && (
                          <p className="text-sm text-red-100">
                            यह अनुरोध आपके खाते से पैसे काटता है। पैसे प्राप्त
                            करने के लिए कभी भी UPI PIN की आवश्यकता नहीं होती।
                            इसे तुरंत अस्वीकार (Decline) करें।
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Link Checker Real Domain Card */}
                  {result.tab === 'link' && (
                    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <Globe className="h-5 w-5 text-slate-600 dark:text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {isHindi
                              ? 'असली डोमेन (Real Domain)'
                              : 'Real Domain Detected'}
                          </p>
                          {result.urls.length > 0 ? (
                            <div className="mt-1 space-y-1">
                              {result.urls.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex flex-wrap items-center gap-2"
                                >
                                  <span className="font-mono text-base font-bold text-slate-900 dark:text-white break-all">
                                    {item.domain || item.url}
                                  </span>
                                  <span className="text-xs text-slate-400 dark:text-slate-500 font-mono truncate max-w-xs">
                                    ({item.url})
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                              {isHindi
                                ? 'टेक्स्ट में कोई मान्य लिंक नहीं मिला। पूरा URL पेस्ट करें।'
                                : 'No recognizable URL found. Try pasting a full link like http://example.xyz/login'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Large Rounded Animated Verdict Card */}
                  <motion.div
                    animate={
                      result.verdict === 'Dangerous'
                        ? {
                            boxShadow: [
                              '0 0 0 0 rgba(220, 38, 38, 0.0)',
                              '0 0 28px 2px rgba(220, 38, 38, 0.28)',
                              '0 0 0 0 rgba(220, 38, 38, 0.0)',
                            ],
                          }
                        : undefined
                    }
                    transition={
                      result.verdict === 'Dangerous'
                        ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
                        : undefined
                    }
                    className={`rounded-2xl border p-6 space-y-5 ${verdictStyle.cardBg} ${verdictStyle.border}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <span
                          className="text-4xl leading-none"
                          aria-hidden="true"
                        >
                          {verdictStyle.emoji}
                        </span>
                        <div>
                          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            {isHindi ? 'जाँच परिणाम' : 'Risk Verdict'}
                          </p>
                          <h2
                            className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${verdictStyle.text}`}
                          >
                            {isHindi
                              ? `${verdictStyle.labelHi} (${verdictStyle.labelEn})`
                              : verdictStyle.labelEn}
                          </h2>
                        </div>
                      </div>

                      <div className="flex items-center gap-5">
                        <SemiGauge
                          score={displayScore}
                          strokeColor={verdictStyle.strokeColor}
                        />

                        {/* Copy & Share on WhatsApp Buttons */}
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCopyWarning}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300/80 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {copied ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                <span>{isHindi ? 'कॉपी हो गया!' : 'Copied!'}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>
                                  {isHindi
                                    ? 'चेतावनी कॉपी करें'
                                    : 'Copy warning'}
                                </span>
                              </>
                            )}
                          </button>

                          <a
                            href={shareUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            <span>
                              {isHindi
                                ? 'WhatsApp पर भेजें'
                                : 'Share on WhatsApp'}
                            </span>
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Animated Risk Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="h-3 w-full rounded-full bg-white/80 dark:bg-slate-900/80 border border-black/5 dark:border-white/10 overflow-hidden">
                        <motion.div
                          initial={{ scaleX: 0 }}
                          animate={{
                            scaleX: Math.max(0.03, result.score / 100),
                          }}
                          transition={{
                            duration: 0.7,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          className={`h-full w-full origin-left rounded-full ${verdictStyle.barColor}`}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                        <span>0 Safe</span>
                        <span>31 Suspicious</span>
                        <span>66–100 Dangerous</span>
                      </div>
                    </div>

                    {/* Red-flag & Good-sign Chips */}
                    <div className="space-y-2.5 pt-3 border-t border-black/10 dark:border-white/10">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {isHindi ? 'पहचाने गए संकेत' : 'Detected Signals'}
                      </p>
                      {result.flags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {result.flags.map((flag) => (
                            <span
                              key={flag.id}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                                flag.isGood
                                  ? 'bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
                                  : 'bg-white dark:bg-slate-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800/80'
                              }`}
                            >
                              {flag.isGood ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />
                              )}
                              <span>{flag.reason}</span>
                              {flag.points !== 0 && (
                                <span className="font-mono font-semibold tabular-nums opacity-80">
                                  {flag.points > 0
                                    ? `+${flag.points}`
                                    : flag.points}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {isHindi
                            ? 'कोई ज्ञात स्कैम नियम मेल नहीं खाया।'
                            : 'No known scam rules matched this input.'}
                        </p>
                      )}
                    </div>
                  </motion.div>

                  {/* Highlighted Message Inspector (Main Demo Feature) */}
                  <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {isHindi
                            ? 'संदिग्ध शब्दों और लिंक की पहचान'
                            : 'Message Highlight Inspector'}
                        </h3>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {isHindi
                          ? 'कारण देखने के लिए हाइलाइट पर होवर या टैप करें'
                          : 'Hover or tap highlighted text to see why'}
                      </span>
                    </div>

                    <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 p-4 text-[15px] leading-7 text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
                      {highlightSegments.map((seg, idx) => {
                        if (!seg.highlight) {
                          return <span key={idx}>{seg.text}</span>;
                        }
                        const isOpen = activeHighlightIdx === idx;
                        return (
                          <span
                            key={idx}
                            tabIndex={0}
                            onMouseEnter={() => setActiveHighlightIdx(idx)}
                            onMouseLeave={() =>
                              setActiveHighlightIdx((curr) =>
                                curr === idx ? null : curr
                              )
                            }
                            onFocus={() => setActiveHighlightIdx(idx)}
                            onBlur={() =>
                              setActiveHighlightIdx((curr) =>
                                curr === idx ? null : curr
                              )
                            }
                            onClick={() =>
                              setActiveHighlightIdx((curr) =>
                                curr === idx ? null : idx
                              )
                            }
                            className={`relative inline-block px-1 py-0.5 mx-0.5 rounded-sm border-b-2 font-medium cursor-help transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                              seg.isGood
                                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border-emerald-500'
                                : 'bg-red-100 dark:bg-red-950/80 text-red-900 dark:text-red-200 border-red-500'
                            }`}
                          >
                            {seg.text}
                            {isOpen && (
                              <span
                                role="tooltip"
                                className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-30 w-64 max-w-[80vw] rounded-xl bg-slate-900 dark:bg-slate-800 text-white border border-slate-700 px-3 py-2 text-xs leading-relaxed shadow-xl pointer-events-none text-left"
                              >
                                <span className="block font-semibold text-white">
                                  {seg.reason}
                                </span>
                                {typeof seg.points === 'number' &&
                                  seg.points !== 0 && (
                                    <span
                                      className={`mt-1 inline-block font-mono font-bold tabular-nums ${
                                        seg.isGood
                                          ? 'text-emerald-300'
                                          : 'text-rose-300'
                                      }`}
                                    >
                                      {seg.points > 0
                                        ? `+${seg.points} risk points`
                                        : `${seg.points} risk points (good sign)`}
                                    </span>
                                  )}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm bg-red-500/80 inline-block" />
                        <span>
                          {isHindi ? 'जोखिम शब्द / लिंक' : 'Risky word or link'}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/80 inline-block" />
                        <span>
                          {isHindi ? 'सुरक्षा संकेत' : 'Good safety sign'}
                        </span>
                      </span>
                    </div>
                  </section>

                  {/* Two-column Breakdown + "Why?" Explanation */}
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
                    {/* Risk Score Breakdown & Percentage Share */}
                    <section className="xl:col-span-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            {isHindi
                              ? 'जोखिम स्कोर विभाजन (Risk Breakdown)'
                              : 'Why It Scored This Way'}
                          </h3>
                        </div>
                        <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                          {result.score}/100
                        </span>
                      </div>

                      {/* Step-by-step category scores on Message Checker */}
                      {result.tab === 'message' && (
                        <div className="grid grid-cols-3 gap-2.5 text-center">
                          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 p-2.5">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {isHindi ? 'संदेश नियम' : 'Message'}
                            </p>
                            <p className="font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                              {result.breakdown.messagePoints >= 0
                                ? `+${result.breakdown.messagePoints}`
                                : result.breakdown.messagePoints}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 p-2.5">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {isHindi ? 'UPI कलेक्ट (½)' : 'Collect (½)'}
                            </p>
                            <p className="font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                              +{result.breakdown.collectPoints}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 p-2.5">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {isHindi ? 'लिंक जांच' : 'Links'}
                            </p>
                            <p className="font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                              +{result.breakdown.linkPoints}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Per-rule percentage and risk score */}
                      {positiveFlags.length > 0 || goodFlags.length > 0 ? (
                        <div className="space-y-3">
                          {positiveFlags.map((flag) => (
                            <div key={flag.id} className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                  {flag.reason}
                                </span>
                                <span className="font-mono font-semibold text-red-700 dark:text-red-300 tabular-nums whitespace-nowrap shrink-0">
                                  +{flag.points} pts · {flag.percentage ?? 0}%
                                </span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <motion.div
                                  initial={{ scaleX: 0 }}
                                  animate={{
                                    scaleX: Math.max(
                                      0.04,
                                      (flag.percentage ?? 0) / 100
                                    ),
                                  }}
                                  transition={{
                                    duration: 0.55,
                                    ease: [0.16, 1, 0.3, 1],
                                  }}
                                  className="h-full w-full origin-left rounded-full bg-red-500 dark:bg-red-400"
                                />
                              </div>
                            </div>
                          ))}

                          {goodFlags.map((flag) => (
                            <div
                              key={flag.id}
                              className="flex items-center justify-between gap-2 text-xs pt-1 text-emerald-700 dark:text-emerald-300"
                            >
                              <span className="font-medium">{flag.reason}</span>
                              <span className="font-mono font-semibold tabular-nums whitespace-nowrap shrink-0">
                                {flag.points} pts (reduces risk)
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {isHindi
                            ? 'कोई संदिग्ध कारक नहीं मिला (0% जोखिम योगदान)।'
                            : 'No suspicious factors triggered (0% risk contribution).'}
                        </p>
                      )}
                    </section>

                    {/* "Why?" AI Explanation Card */}
                    <section className="xl:col-span-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between gap-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                              {isHindi ? 'क्यों? (Why?)' : 'Why?'}
                            </h3>
                          </div>
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {isHindi ? 'हिंदी' : 'English'}
                          </span>
                        </div>

                        {isExplaining ? (
                          <div className="py-8 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
                            <Loader2 className="h-6 w-6 animate-spin text-indigo-600 dark:text-indigo-400" />
                            <p className="text-sm font-medium">
                              {isHindi
                                ? 'सरल भाषा में कारण तैयार किया जा रहा है...'
                                : 'Preparing plain-language explanation...'}
                            </p>
                          </div>
                        ) : (
                          renderFormattedExplanation(explanation)
                        )}
                      </div>

                      <p className="text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                        {isHindi
                          ? 'निजता सुरक्षा: AI को भेजने से पहले फ़ोन नंबर और लंबे नंबर छिपा दिए जाते हैं।'
                          : 'Privacy note: Phone numbers and 9–18 digit numbers are masked before explanation.'}
                      </p>
                    </section>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Side Summary Column */}
          <aside className="space-y-5 lg:col-span-2 xl:col-span-1">
            {/* Total Checks & Dangerous Found Card */}
            <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {isHindi ? 'लाइव जाँच सारांश' : 'Live Check Summary'}
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 p-3.5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isHindi ? 'कुल जाँच' : 'Total checks'}
                  </p>
                  <p className="font-mono text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-1">
                    {stats.total}
                  </p>
                </div>

                <div className="rounded-xl bg-red-50/70 dark:bg-red-950/30 border border-red-200/80 dark:border-red-900/60 p-3.5">
                  <p className="text-xs text-red-700 dark:text-red-300">
                    {isHindi ? 'खतरनाक मिले' : 'Dangerous'}
                  </p>
                  <p className="font-mono text-2xl font-extrabold text-red-700 dark:text-red-300 tabular-nums mt-1">
                    {stats.dangerous}
                  </p>
                </div>
              </div>
            </section>

            {/* Recent Anonymous Checks (Verdict, Score, Timestamp only) */}
            <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isHindi ? 'हाल की जाँच' : 'Recent Checks'}
                </h2>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  {isHindi ? 'केवल स्कोर' : 'Scores only'}
                </span>
              </div>

              {stats.recent.length > 0 ? (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stats.recent.map((item, idx) => (
                    <li
                      key={`${item.timestamp}-${idx}`}
                      className="py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span aria-hidden="true">
                          {VERDICT_CONFIG[item.verdict]?.emoji || '✅'}
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.verdict}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400">
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                          {item.score}/100
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {formatTimeAgo(item.timestamp, isHindi)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {isHindi
                    ? 'अभी तक कोई जाँच नहीं हुई है। ऊपर कोई संदेश या सैंपल जाँचें।'
                    : 'No checks yet. Paste a message or try one of the four samples.'}
                </p>
              )}
            </section>

            {/* Cybercrime Reports & Helpline */}
            <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isHindi ? 'रिपोर्ट और सहायता' : 'Reports & Helpline'}
                </h2>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {isHindi
                  ? 'यदि आपसे पैसे कट गए हैं या किसी स्कैम लिंक पर क्लिक हो गया है, तो तुरंत राष्ट्रीय साइबर क्राइम हेल्पलाइन पर रिपोर्ट करें।'
                  : 'If you lost money or clicked a suspicious link, report immediately to the National Cybercrime Helpline.'}
              </p>

              <div className="space-y-2 pt-1">
                <a
                  href="tel:1930"
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-indigo-900 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-950 transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <PhoneCall className="h-3.5 w-3.5" />
                    <span>
                      {isHindi ? 'कॉल करें: 1930' : 'Call Helpline 1930'}
                    </span>
                  </span>
                  <span className="font-mono tabular-nums">24×7</span>
                </a>

                <a
                  href="https://cybercrime.gov.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <span>cybercrime.gov.in</span>
                  <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                </a>
              </div>
            </section>
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mt-auto">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          <p>
            {isHindi
              ? 'यह केवल निर्णय सहायता है, गारंटी नहीं। 1930 पर रिपोर्ट करें।'
              : 'Decision support, not a guarantee. Report at 1930.'}
          </p>
          <div className="flex items-center gap-4">
            <a
              href="tel:1930"
              className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              <span>Helpline 1930</span>
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://cybercrime.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              <span>cybercrime.gov.in</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
