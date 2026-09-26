import React, { useState, useEffect, useRef } from 'react';
import { Logo } from './components/Logo';
import { ChatWidget } from './components/ChatWidget';
import { 
  Sprout, 
  Bug, 
  History, 
  LayoutDashboard, 
  ChevronRight, 
  Upload, 
  Thermometer, 
  Droplets, 
  CloudRain, 
  FlaskConical,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Camera,
  X,
  Home,
  TrendingUp,
  BookOpen,
  Settings,
  Bell,
  Search,
  Languages,
  User,
  Wind,
  Sun,
  MapPin,
  Bookmark,
  BookmarkCheck,
  Filter,
  ArrowLeft,
  RefreshCw,
  TrendingDown as TrendingDownIcon,
  TrendingUp as TrendingUpIcon,
  Map,
  LogOut,
  Loader2,
  ShoppingBag,
  Store,
  Menu,
  Key,
  Sparkles,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { agricultureService, CropInput, PredictionResult } from './services/aiService';
import { initKnowledgeBase } from './services/ragService';
import { marketService, MarketPrice, MarketFilters } from './services/marketService';
import { articles, Article } from './data/articles';
import { useGreeting, useWeather, getFarmingInsights } from './hooks/useAgricultureDashboard';
import { useLocation } from './hooks/useLocation';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useAppContext } from './context/AppContext';
import { Login } from './components/auth/Login';
import { ProfileSetup } from './components/auth/ProfileSetup';
import { ProfileSettings } from './components/auth/ProfileSettings';
import { LocationBanner } from './components/LocationBanner';
import { LanguageSelector } from './components/LanguageSelector';
import { FertilizerRecommendation } from './components/fertilizer/FertilizerRecommendation';
import { HistoryModal } from './components/HistoryModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { extractSoilParametersFromImage } from './services/ocrService';
import { FarmMap } from './components/gis/FarmMap';
import { CropHealthDashboard } from './components/gis/CropHealthDashboard';
import { useHistoryStore } from './stores/historyStore';
import { useUIStore, type UIActiveTab } from './stores/uiStore';
import { useTranslation } from 'react-i18next';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function TabPanel({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  if (!active) {
    return null;
  }

  return <div>{children}</div>;
}

type Tab = UIActiveTab;

const HERO_CONTENT = [
  {
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=90&w=1920",
    titleKey: "home.slogan1",
    subtitleKey: "home.subtitle1",
    accent: "from-emerald-600/30"
  },
  {
    image: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&q=90&w=1920",
    titleKey: "home.slogan2",
    subtitleKey: "home.subtitle2",
    accent: "from-green-600/30"
  },
  {
    image: "https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&q=90&w=1920",
    titleKey: "home.slogan3",
    subtitleKey: "home.subtitle3",
    accent: "from-teal-600/30"
  },
  {
    image: "https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&q=90&w=1920",
    titleKey: "home.slogan4",
    subtitleKey: "home.subtitle4",
    accent: "from-lime-600/30"
  },
  {
    image: "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&q=90&w=1920",
    titleKey: "home.slogan5",
    subtitleKey: "home.subtitle5",
    accent: "from-emerald-700/30"
  },
  {
    image: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&q=90&w=1920",
    titleKey: "home.slogan1",
    subtitleKey: "home.subtitle1",
    accent: "from-green-700/30"
  },
  {
    image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&q=90&w=1920",
    titleKey: "home.slogan2",
    subtitleKey: "home.subtitle2",
    accent: "from-emerald-500/30"
  }
];

export function AppContent() {
  const { t } = useTranslation();
  const [showLocationBanner, setShowLocationBanner] = useState(false);
  const { user, loading: authLoading, updateProfile } = useAuth();
  const { appData, updateModuleData } = useAppContext();
  const history = useHistoryStore((state) => state.history);
  const addEntry = useHistoryStore((state) => state.addEntry);
  const activeTab = useUIStore((state) => state.activeTab);
  const setActiveTab = useUIStore((state) => state.setActiveTab);
  const showHistory = useUIStore((state) => state.showHistory);
  const setShowHistory = useUIStore((state) => state.setShowHistory);

  const [showProfileSidePopup, setShowProfileSidePopup] = useState(true);
  const [isProfileWidgetExpanded, setIsProfileWidgetExpanded] = useState(false);
  const [showDotTooltip, setShowDotTooltip] = useState(false);
  const [popupLocation, setPopupLocation] = useState(user?.location || '');
  const [popupFarmType, setPopupFarmType] = useState(user?.farmType || 'Organic');
  const [savingPopup, setSavingPopup] = useState(false);
  const [mapBoundary, setMapBoundary] = useState<any>(null);

  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [advisorOcrLoading, setAdvisorOcrLoading] = useState(false);
  const [advisorOcrMsg, setAdvisorOcrMsg] = useState<string | null>(null);
  const [advisorDragging, setAdvisorDragging] = useState(false);
  const advisorFileInputRef = useRef<HTMLInputElement>(null);

  const handleAdvisorImageFile = async (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, JPEG, WEBP).');
      return;
    }
    setAdvisorOcrLoading(true);
    setAdvisorOcrMsg(null);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });
      const base64 = await base64Promise;
      const extracted = await extractSoilParametersFromImage(base64);

      updateModuleData('cropForm', {
        ...appData.cropForm,
        nitrogen: extracted.nitrogen !== undefined ? String(extracted.nitrogen) : appData.cropForm.nitrogen,
        phosphorus: extracted.phosphorus !== undefined ? String(extracted.phosphorus) : appData.cropForm.phosphorus,
        potassium: extracted.potassium !== undefined ? String(extracted.potassium) : appData.cropForm.potassium,
        temperature: extracted.temperature !== undefined ? String(extracted.temperature) : appData.cropForm.temperature,
        humidity: extracted.humidity !== undefined ? String(extracted.humidity) : appData.cropForm.humidity,
        ph: extracted.ph !== undefined ? String(extracted.ph) : appData.cropForm.ph,
        rainfall: extracted.rainfall !== undefined ? String(extracted.rainfall) : appData.cropForm.rainfall,
      });

      setAdvisorOcrMsg(`Values extracted from image: N: ${extracted.nitrogen ?? '--'}, P: ${extracted.phosphorus ?? '--'}, K: ${extracted.potassium ?? '--'}, pH: ${extracted.ph ?? '--'}`);
    } catch (err) {
      console.error('Advisor OCR extraction error:', err);
      alert('Failed to analyze image. Please enter values manually.');
    } finally {
      setAdvisorOcrLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      if (user.location) setPopupLocation(user.location);
      if (user.farmType) setPopupFarmType(user.farmType);
    }
  }, [user?.location, user?.farmType]);

  const handleSaveProfilePopup = async () => {
    setSavingPopup(true);
    try {
      await updateProfile({
        name: user?.name || 'Farmer',
        location: popupLocation || 'General',
        farmType: popupFarmType || 'Organic',
      });
      setShowProfileSidePopup(false);
    } catch (err) {
      console.error('Failed to update profile popup:', err);
    } finally {
      setSavingPopup(false);
    }
  };

  const [lastMarketUpdate, setLastMarketUpdate] = useState<Date>(new Date());

  const logoClicksRef = useRef<{ count: number; lastTime: number }>({ count: 0, lastTime: 0 });

  const handleLogoSecretClick = () => {
    const now = Date.now();
    if (now - logoClicksRef.current.lastTime < 700) {
      logoClicksRef.current.count += 1;
      if (logoClicksRef.current.count >= 3) {
        setShowApiKeyModal(true);
        logoClicksRef.current.count = 0;
        return;
      }
    } else {
      logoClicksRef.current.count = 1;
    }
    logoClicksRef.current.lastTime = now;
    switchTab('home');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setShowApiKeyModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const greetingKey = useGreeting();
  const { location, loading: locationLoading, error: locationError, denied: locationDenied, refresh: refreshLocation, setManualLocation } = useLocation();
  const { weather, loading: weatherDataLoading, error: weatherError, refresh: refreshWeather } = useWeather(user?.location || location?.city || appData.weatherCity, location?.lat, location?.lon);
  const farmingInsights = weather ? getFarmingInsights(weather, t) : [];

  useEffect(() => {
    if (locationDenied || locationError) {
      setShowLocationBanner(true);
    } else {
      setShowLocationBanner(false);
    }
  }, [locationDenied, locationError]);

  useEffect(() => {
    if (location) {
      // Only update weather based on location; keep market filters at "All States"
      fetchWeather(location.city || appData.weatherCity, location.lat, location.lon);
    }
  }, [location]);

  useEffect(() => {
    initKnowledgeBase();
  }, []);

  useEffect(() => {
    console.log('market:', appData.market);
    console.log('priceTrends:', appData.priceTrends);
    console.log('selectedMarketCrop:', appData.selectedMarketCrop);
    console.log('result:', appData.fertilizer);
    console.log('activeTab:', activeTab);
  }, [activeTab, appData.fertilizer, appData.market, appData.priceTrends, appData.selectedMarketCrop]);

  useEffect(() => {
    if (user) {
      fetchWeather(user.location || 'Bangalore', location?.lat, location?.lon);
      fetchMarketData();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // Auto-refresh market data every 5 minutes
    const interval = setInterval(() => {
      fetchMarketData();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  const fetchMarketData = async (filters = appData.marketFilters) => {
    updateModuleData('marketLoading', true);
    updateModuleData('marketError', null);
    try {
      const data = await marketService.getPrices(filters);
      if (!data || data.length === 0) {
        updateModuleData('market', []);
        updateModuleData('selectedMarketCrop', null);
        updateModuleData('priceTrends', null);
        // Don't set marketError — just show empty list in the UI
        return;
      }

      updateModuleData('market', data);
      setLastMarketUpdate(new Date());
      
      const insight = await agricultureService.generateMarketInsights(data);
      updateModuleData('priceTrends', insight);

      if (!appData.selectedMarketCrop || !data.some((item) => item.id === appData.selectedMarketCrop.id)) {
        updateModuleData('selectedMarketCrop', data[0]);
      }
    } catch (err: any) {
      console.error("Failed to fetch market data");
      updateModuleData('marketError', err.message || "Failed to connect to market service.");
    } finally {
      updateModuleData('marketLoading', false);
    }
  };

  const handleMarketFilterChange = (newFilters: Partial<MarketFilters>) => {
    const updated = { ...appData.marketFilters, ...newFilters };
    updateModuleData('marketFilters', updated);
    fetchMarketData(updated);
  };

  const fetchWeather = async (city: string, lat?: number, lon?: number) => {
    updateModuleData('weatherLoading', true);
    updateModuleData('weatherError', null);
    updateModuleData('weatherCity', city);

    const OWM_KEY = '19927003d654bcd63f64e32840eeba91';

    const fallbackData = {
      status: 'ok',
      city: city || 'Unknown',
      temp: 25,
      humidity: 60,
      windSpeed: 5,
      condition: 'Clear',
      description: 'Clear sky (Fallback)',
      icon: '01d',
      uvIndex: 'Moderate',
      insights: ["Weather data currently unavailable. Showing seasonal averages."],
      forecast: [],
      fallback: true
    };

    try {
      let currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OWM_KEY}&units=metric`;
      let forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${OWM_KEY}&units=metric`;

      if (lat && lon) {
        currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`;
        forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`;
      }

      const [currentRes, forecastRes] = await Promise.all([
        fetch(currentUrl),
        fetch(forecastUrl)
      ]);

      if (!currentRes.ok) {
        console.warn(`[WEATHER] OpenWeatherMap responded with ${currentRes.status}`);
        updateModuleData('weather', fallbackData);
        return;
      }

      const currentData = await currentRes.json();
      const forecastData = forecastRes.ok ? await forecastRes.json() : { list: [] };

      // Rule-based farming insights
      const insights: string[] = [];
      const temp = currentData.main.temp;
      const humidity = currentData.main.humidity;
      const weatherMain = currentData.weather[0].main.toLowerCase();

      if (humidity > 70 && (weatherMain.includes('rain') || weatherMain.includes('drizzle'))) {
        insights.push("High humidity & rainfall detected. Suitable for water-intensive crops like Rice or Sugarcane.");
        insights.push("High fungal risk due to moisture. Avoid Tomato or Potato exposure if possible.");
      } else if (temp > 30 && humidity < 40) {
        insights.push("Low humidity & high temperature. Suitable for drought-resistant crops like Millet or Cotton.");
        insights.push("Ensure adequate irrigation to prevent soil moisture depletion.");
      } else if (temp < 15) {
        insights.push("Cooler temperatures detected. Suitable for Rabi crops like Wheat or Mustard.");
      } else {
        insights.push("Moderate weather conditions. Good for a variety of seasonal vegetables.");
      }

      if (currentData.wind.speed > 20) {
        insights.push("Strong winds detected. Secure young saplings and avoid spraying pesticides.");
      }

      const dailyForecast = forecastData.list
        ? forecastData.list
            .filter((_: any, index: number) => index % 8 === 0)
            .map((item: any) => ({
              date: item.dt_txt.split(' ')[0],
              temp: Math.round(item.main.temp),
              condition: item.weather[0].main,
              icon: item.weather[0].icon
            }))
        : [];

      updateModuleData('weather', {
        status: 'ok',
        city: currentData.name,
        temp: Math.round(currentData.main.temp),
        humidity: currentData.main.humidity,
        windSpeed: currentData.wind.speed,
        condition: currentData.weather[0].main,
        description: currentData.weather[0].description,
        icon: currentData.weather[0].icon,
        uvIndex: 'Moderate',
        insights,
        forecast: dailyForecast
      });
    } catch (err) {
      console.error("Failed to fetch weather:", err);
      // Show fallback instead of error so UI doesn't break
      updateModuleData('weather', fallbackData);
    } finally {
      updateModuleData('weatherLoading', false);
    }
  };

  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % HERO_CONTENT.length);
    }, 5000); // Auto-advance every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const [cropSubmitted, setCropSubmitted] = useState(false);
  const [diseaseSubmitted, setDiseaseSubmitted] = useState(false);
  const emptyCropForm = {
    nitrogen: '',
    phosphorus: '',
    potassium: '',
    temperature: '',
    humidity: '',
    ph: '',
    rainfall: ''
  };

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
  };

  const resetAdvisorResult = () => {
    updateModuleData('cropForm', emptyCropForm);
    updateModuleData('advisor', null);
    updateModuleData('advisorError', null);
    setCropSubmitted(false);
  };

  const resetDiseaseResult = () => {
    updateModuleData('disease', null);
    updateModuleData('diseaseError', null);
    updateModuleData('selectedImage', null);
    setDiseaseSubmitted(false);
  };

  const isCropFormEmpty = Object.values(appData.cropForm).every((value) => value === '');

  const handleCropRecommendation = async (e?: React.FormEvent | React.MouseEvent) => {
    console.log("Crop Analysis triggered");
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Manual validation check
    const values = Object.values(appData.cropForm);
    if (values.some(v => v === '')) {
      updateModuleData('advisorError', "Please fill in all soil parameters before analyzing.");
      return;
    }

    const input: CropInput = {
      nitrogen: Number(appData.cropForm.nitrogen),
      phosphorus: Number(appData.cropForm.phosphorus),
      potassium: Number(appData.cropForm.potassium),
      temperature: Number(appData.cropForm.temperature),
      humidity: Number(appData.cropForm.humidity),
      ph: Number(appData.cropForm.ph),
      rainfall: Number(appData.cropForm.rainfall),
      location: location?.city || user?.location
    };

    updateModuleData('advisorLoading', true);
    updateModuleData('advisorError', null);
    try {
      const res = await agricultureService.recommendCrop(input);
      updateModuleData('advisor', res);
      addEntry({
        id: Date.now(),
        module: 'soil',
        input,
        output: res,
        timestamp: new Date().toISOString(),
      });
      setCropSubmitted(true);
      switchTab('advisor');
    } catch (err: any) {
      updateModuleData('advisorError', err.message);
    } finally {
      updateModuleData('advisorLoading', false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateModuleData('selectedImage', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDiseaseDetection = async (e?: React.FormEvent | React.MouseEvent) => {
    console.log("Disease Detection triggered");
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!appData.selectedImage) return;
    updateModuleData('diseaseLoading', true);
    updateModuleData('diseaseError', null);
    try {
      const res = await agricultureService.detectDisease(appData.selectedImage);
      updateModuleData('disease', res);
      addEntry({
        id: Date.now(),
        module: 'disease',
        input: { image: 'Uploaded Image' },
        output: res,
        timestamp: new Date().toISOString(),
      });
      setDiseaseSubmitted(true);
      switchTab('disease');
    } catch (err: any) {
      updateModuleData('diseaseError', err.message);
    } finally {
      updateModuleData('diseaseLoading', false);
    }
  };

  const renderHome = () => (
    <div>

      {/* ── FULL-SCREEN CINEMATIC CAROUSEL HERO ── */}
      <div
        className="relative w-full overflow-hidden"
        style={{ height: 'calc(100vh - 80px)' }}
      >
        {/* IMAGES ONLY — fade in/out via AnimatePresence */}
        <AnimatePresence mode="wait">
          <motion.div
            key={heroIndex}
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute inset-0"
          >
            <img
              src={HERO_CONTENT[heroIndex].image}
              alt="Hero"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </AnimatePresence>

        {/* Static dark overlays (always present) */}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/50 to-stone-950/20 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950/60 via-transparent to-stone-950/30 pointer-events-none" />

        {/* STATIC TEXT — never re-animates, always centered */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-6 text-center">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-[0.25em]">
              {locationLoading ? 'Fetching...' : location ? `${location.city || location.state}` : 'Smart Agriculture'}
            </span>
          </div>

          <h2 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight mb-4 drop-shadow-2xl">
            {t(greetingKey)},
            <br />
            <span className="text-emerald-400">{user?.name || 'Farmer'}</span>
          </h2>

          <p className="text-stone-300 text-base md:text-lg max-w-xl leading-relaxed mb-8 drop-shadow-lg">
            {t('home.subtitle3')}
          </p>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => switchTab('advisor')}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold rounded-2xl transition-all active:scale-95 shadow-xl shadow-emerald-500/40 flex items-center space-x-2"
            >
              <Sprout size={18} />
              <span>{t('home.cropAdvisor')}</span>
            </button>
            <button
              onClick={() => switchTab('disease')}
              className="px-6 py-3 bg-white/10 hover:bg-white/25 backdrop-blur-md text-white text-sm font-bold rounded-2xl border border-white/25 transition-all active:scale-95 flex items-center space-x-2"
            >
              <Bug size={18} />
              <span>{t('home.diseaseDetection')}</span>
            </button>
          </div>
        </div>

        {/* Carousel Dot Indicators — static, at bottom center */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center space-x-2 z-20">
          {HERO_CONTENT.map((_, i) => (
            <button
              key={i}
              onClick={() => setHeroIndex(i)}
              className={cn(
                'transition-all duration-500 rounded-full',
                i === heroIndex
                  ? 'w-8 h-2 bg-emerald-400 shadow-lg shadow-emerald-500/50'
                  : 'w-2 h-2 bg-white/40 hover:bg-white/70'
              )}
            />
          ))}
        </div>
      </div>

      {/* ── MAIN DASHBOARD GRID ── */}
      <div className="px-4 md:px-8 pb-16 pt-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT COLUMN: Action cards + History */}
        <div className="lg:col-span-2 space-y-6">

          {/* Quick Action Grid */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { tab: 'advisor', icon: Sprout, label: t('home.cropAdvisor'), desc: t('home.cropAdvisorDesc'), color: 'bg-emerald-500', iconBg: 'bg-white/20', textColor: 'text-white', descColor: 'text-white/70' },
              { tab: 'fertilizer', icon: FlaskConical, label: t('home.fertilizerRecommendation'), desc: t('home.fertilizerRecommendationDesc'), color: 'bg-stone-900/80 border border-stone-700/80 hover:border-emerald-500/40', iconBg: 'bg-emerald-500/10', textColor: 'text-white', descColor: 'text-stone-400', iconColor: 'text-emerald-400' },
              { tab: 'disease', icon: Bug, label: t('home.diseaseDetection'), desc: t('home.diseaseDetectionDesc'), color: 'bg-stone-900/80 border border-stone-700/80 hover:border-amber-500/40', iconBg: 'bg-amber-500/10', textColor: 'text-white', descColor: 'text-stone-400', iconColor: 'text-amber-400' },
              { tab: 'marketplace', icon: Store, label: t('home.marketing'), desc: t('home.marketingDesc'), color: 'bg-stone-900/80 border border-stone-700/80 hover:border-blue-500/40', iconBg: 'bg-blue-500/10', textColor: 'text-white', descColor: 'text-stone-400', iconColor: 'text-blue-400' },
            ].map((action) => (
              <button
                key={action.tab}
                onClick={() => switchTab(action.tab as Tab)}
                className={cn(
                  'p-5 rounded-2xl flex flex-col items-start text-left group transition-all active:scale-[0.97] shadow-lg backdrop-blur-sm',
                  action.color
                )}
              >
                <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center mb-3', action.iconBg)}>
                  <action.icon size={20} className={action.iconColor || 'text-white'} />
                </div>
                <h3 className={cn('font-bold text-sm leading-snug mb-1', action.textColor)}>{action.label}</h3>
                <p className={cn('text-xs leading-relaxed line-clamp-2', action.descColor)}>{action.desc}</p>
              </button>
            ))}
          </div>

          {/* AI Command Center alerts */}
          <AnimatePresence>
            {farmingInsights.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center">
                    <LayoutDashboard size={14} className="mr-2 text-emerald-500" />
                    {t('home.commandCenter')}
                  </h3>
                  <span className="text-[10px] text-stone-400 bg-stone-800/60 px-2.5 py-1 rounded-full border border-stone-700/60">
                    {t('home.liveAnalysis')}
                  </span>
                </div>
                {farmingInsights.map((insight, index) => {
                  const Icon = insight.type === 'rain' ? CloudRain : insight.type === 'heat' ? Sun : Sprout;
                  return (
                    <motion.div
                      key={insight.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.1 }}
                      className={cn('p-4 rounded-2xl border flex items-start space-x-3 backdrop-blur-sm', insight.color)}
                    >
                      <div className="p-2 rounded-xl bg-white/5"><Icon size={18} /></div>
                      <div>
                        <h4 className="text-sm font-bold mb-0.5">{insight.title}</h4>
                        <p className="text-xs opacity-80 leading-relaxed">{insight.message}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>

          {/* Recent History */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-white">{t('home.recentActivities')}</h3>
              <button type="button" onClick={() => setShowHistory(true)} className="text-emerald-400 text-sm font-medium hover:text-emerald-300 transition-colors">
                {t('home.seeAll')}
              </button>
            </div>
            <div className="space-y-3">
              {history.slice(0, 4).map((item) => {
                const output = item.output || {};
                const confidence = typeof output.confidence === 'number' ? output.confidence : null;
                const resultLabel = typeof output.result === 'string' ? output.result : typeof output.fertilizerName === 'string' ? output.fertilizerName : 'Saved Analysis';
                return (
                  <div key={item.id} className="bg-stone-900/70 backdrop-blur-sm p-4 rounded-2xl border border-stone-700/60 flex items-center justify-between hover:border-stone-600 transition-colors">
                    <div className="flex items-center">
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mr-3', item.module === 'soil' ? 'bg-emerald-500/10 text-emerald-400' : item.module === 'fertilizer' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400')}>
                        {item.module === 'soil' ? <Sprout size={18} /> : item.module === 'fertilizer' ? <FlaskConical size={18} /> : <Bug size={18} />}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-white truncate max-w-[160px]">{resultLabel}</div>
                        <div className="text-[10px] text-stone-400">{new Date(item.timestamp).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-stone-500 uppercase font-bold">{item.module}</div>
                      <div className="text-xs font-bold text-emerald-400">{confidence !== null ? `${(confidence * 100).toFixed(0)}%` : 'Saved'}</div>
                    </div>
                  </div>
                );
              })}
              {history.length === 0 && (
                <div className="text-center py-10 text-stone-500 text-sm italic bg-stone-900/40 rounded-2xl border border-stone-800/60">{t('home.noActivities')}</div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Weather + Location + Quick stats */}
        <div className="space-y-4">

          {/* Location bar */}
          <div className="bg-stone-900/70 backdrop-blur-sm rounded-2xl border border-stone-700/60 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={cn('w-2 h-2 rounded-full', location ? 'bg-emerald-400 animate-pulse' : locationDenied ? 'bg-amber-400' : 'bg-stone-500')} />
              <span className="text-xs font-semibold text-stone-300 uppercase tracking-wider truncate">
                {locationLoading ? 'Fetching...' : location ? `${location.city || location.state}` : locationDenied ? 'Location Denied' : 'Unknown'}
              </span>
            </div>
            <button onClick={() => refreshLocation()} disabled={locationLoading} className="p-1.5 hover:bg-stone-800 rounded-lg transition-colors text-stone-400 hover:text-emerald-400 disabled:opacity-40">
              <RefreshCw size={14} className={cn(locationLoading && 'animate-spin')} />
            </button>
          </div>

          {/* Temperature card */}
          <div className="bg-stone-900/70 backdrop-blur-sm rounded-2xl border border-stone-700/60 p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full -translate-y-6 translate-x-6" />
            <div className="flex items-center space-x-2 mb-3">
              <Thermometer size={16} className="text-orange-400" />
              <span className="text-xs font-bold text-stone-400 uppercase tracking-wide">{t('home.temperature')}</span>
            </div>
            {weatherDataLoading ? (
              <div className="space-y-2"><div className="h-9 w-20 bg-stone-800 animate-pulse rounded" /><div className="h-3 w-28 bg-stone-800 animate-pulse rounded" /></div>
            ) : (
              <>
                <div className="text-4xl font-extrabold text-white">{weather?.temp ?? 28}<span className="text-2xl text-stone-400">°C</span></div>
                <div className="text-xs text-stone-400 uppercase tracking-wider mt-1">{weather?.condition ?? 'Clear Sky'}</div>
                {weather?.location && <div className="text-[10px] text-stone-500 mt-1 flex items-center"><MapPin size={8} className="mr-1" />{weather.location}</div>}
              </>
            )}
          </div>

          {/* Humidity card */}
          <div className="bg-stone-900/70 backdrop-blur-sm rounded-2xl border border-stone-700/60 p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -translate-y-6 translate-x-6" />
            <div className="flex items-center space-x-2 mb-3">
              <Droplets size={16} className="text-blue-400" />
              <span className="text-xs font-bold text-stone-400 uppercase tracking-wide">{t('home.humidity')}</span>
            </div>
            {weatherDataLoading ? (
              <div className="space-y-2"><div className="h-9 w-20 bg-stone-800 animate-pulse rounded" /><div className="h-3 w-24 bg-stone-800 animate-pulse rounded" /></div>
            ) : (
              <>
                <div className="text-4xl font-extrabold text-white">{weather?.humidity ?? 65}<span className="text-2xl text-stone-400">%</span></div>
                <div className="text-xs text-stone-400 uppercase tracking-wider mt-1">Optimal range</div>
              </>
            )}
          </div>

          {/* Quick nav shortcuts */}
          <div className="bg-stone-900/70 backdrop-blur-sm rounded-2xl border border-stone-700/60 p-4 space-y-2">
            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">{t('common.quickAccess')}</h4>
            {[
              { tab: 'weather', icon: CloudRain, label: t('common.weather'), color: 'text-sky-400' },
              { tab: 'priceTrends', icon: TrendingUp, label: t('common.priceTrends'), color: 'text-emerald-400' },
              { tab: 'learn', icon: BookOpen, label: t('common.learn'), color: 'text-purple-400' },
            ].map((item) => (
              <button
                key={item.tab}
                onClick={() => switchTab(item.tab as Tab)}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-stone-800/60 transition-colors text-left group"
              >
                <item.icon size={17} className={item.color} />
                <span className="text-sm text-stone-300 group-hover:text-white transition-colors font-medium">{item.label}</span>
                <ChevronRight size={14} className="text-stone-600 ml-auto group-hover:text-stone-400 group-hover:translate-x-0.5 transition-all" />
              </button>
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  );

  const renderAdvisor = () => (
    <div className="space-y-6 pb-24">
      <div className="bg-dark-card rounded-3xl border border-dark-border overflow-hidden">
        <div className="p-6 border-b border-dark-border">
          <h2 className="text-xl font-bold flex items-center">
            <FlaskConical className="mr-2 text-brand-green" />
            {t('advisor.soilAnalysis')}
          </h2>
          <p className="text-stone-500 text-sm mt-1">{t('advisor.soilAnalysisDesc')}</p>
        </div>

        {/* Soil Card Image Dropzone */}
        <div className="p-6 pb-0">
          <div
            onDragOver={(e) => { e.preventDefault(); setAdvisorDragging(true); }}
            onDragLeave={() => setAdvisorDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setAdvisorDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleAdvisorImageFile(file);
            }}
            onClick={() => advisorFileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
              advisorDragging 
                ? 'border-emerald-500 bg-emerald-950/20' 
                : 'border-stone-700/80 bg-stone-900/50 hover:border-emerald-500/50 hover:bg-stone-900'
            }`}
          >
            <input 
              type="file" 
              ref={advisorFileInputRef} 
              onChange={(e) => e.target.files?.[0] && handleAdvisorImageFile(e.target.files[0])} 
              className="hidden" 
              accept="image/*" 
            />
            {advisorOcrLoading ? (
              <div className="flex items-center space-x-2 text-emerald-400 py-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-xs font-bold">Scanning soil report image with AI...</span>
              </div>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Drop Soil Health Card / Lab Test Image</span>
                  <span className="text-[10px] text-stone-400">Auto-fills N, P, K, pH, Temperature, Humidity & Rainfall parameters</span>
                </div>
              </>
            )}
          </div>

          <AnimatePresence>
            {advisorOcrMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs flex items-center space-x-2"
              >
                <Sparkles size={14} className="text-emerald-400 flex-shrink-0" />
                <span className="flex-1">{advisorOcrMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <form
          onSubmit={handleCropRecommendation}
          noValidate
          className="p-6 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-400 uppercase">{t('advisor.nitrogen')}</label>
              <input 
                type="number" 
                placeholder="0-200"
                min="0"
                max="200"
                value={appData.cropForm.nitrogen}
                onChange={e => updateModuleData('cropForm', {...appData.cropForm, nitrogen: e.target.value})}
                className="w-full p-3 rounded-xl text-sm"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-400 uppercase">{t('advisor.phosphorus')}</label>
              <input 
                type="number" 
                placeholder="0-200"
                min="0"
                max="200"
                value={appData.cropForm.phosphorus}
                onChange={e => updateModuleData('cropForm', {...appData.cropForm, phosphorus: e.target.value})}
                className="w-full p-3 rounded-xl text-sm"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-400 uppercase">{t('advisor.potassium')}</label>
              <input 
                type="number" 
                placeholder="0-200"
                min="0"
                max="200"
                value={appData.cropForm.potassium}
                onChange={e => updateModuleData('cropForm', {...appData.cropForm, potassium: e.target.value})}
                className="w-full p-3 rounded-xl text-sm"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-400 uppercase">{t('advisor.phLevel')}</label>
              <input 
                type="number" 
                step="0.1"
                placeholder="0-14"
                min="0"
                max="14"
                value={appData.cropForm.ph}
                onChange={e => updateModuleData('cropForm', {...appData.cropForm, ph: e.target.value})}
                className="w-full p-3 rounded-xl text-sm"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-400 uppercase">{t('advisor.temperature')}</label>
              <input 
                type="number" 
                step="0.1"
                placeholder="-10 to 60"
                min="-10"
                max="60"
                value={appData.cropForm.temperature}
                onChange={e => updateModuleData('cropForm', {...appData.cropForm, temperature: e.target.value})}
                className="w-full p-3 rounded-xl text-sm"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-400 uppercase">{t('advisor.humidity')}</label>
              <input 
                type="number" 
                step="0.1"
                placeholder="0-100"
                min="0"
                max="100"
                value={appData.cropForm.humidity}
                onChange={e => updateModuleData('cropForm', {...appData.cropForm, humidity: e.target.value})}
                className="w-full p-3 rounded-xl text-sm"
                required
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-400 uppercase">{t('advisor.rainfall')}</label>
            <input 
              type="number" 
              step="0.1"
              placeholder="0-1000"
              min="0"
              max="1000"
              value={appData.cropForm.rainfall}
              onChange={e => updateModuleData('cropForm', {...appData.cropForm, rainfall: e.target.value})}
              className="w-full p-3 rounded-xl text-sm"
              required
            />
          </div>
          <button 
            type="submit"
            disabled={appData.advisorLoading}
            className="w-full bg-brand-green hover:bg-brand-green-dark text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center disabled:opacity-50"
          >
            {appData.advisorLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : t('advisor.analyze')}
          </button>
          <button
            type="button"
            onClick={resetAdvisorResult}
            disabled={appData.advisorLoading || (isCropFormEmpty && !appData.advisor && !appData.advisorError)}
            className="w-full bg-stone-700 hover:bg-stone-600 text-white font-bold py-4 rounded-2xl transition-all disabled:opacity-50 disabled:hover:bg-stone-700"
          >
            Enter New Values
          </button>
        </form>
      </div>
      {renderResult(appData.advisor, appData.advisorError, {
        onReset: resetAdvisorResult,
        resetLabel: 'Enter New Values'
      })}
    </div>
  );

  const renderDisease = () => (
    <div className="space-y-6 pb-24">
      <div className="bg-dark-card rounded-3xl border border-dark-border overflow-hidden">
        <div className="p-6 border-b border-dark-border">
          <h2 className="text-xl font-bold flex items-center">
            <Camera className="mr-2 text-amber-500" />
            {t('disease.diseaseDetection')}
          </h2>
          <p className="text-stone-500 text-sm mt-1">{t('disease.scanUpload')}</p>
        </div>
        <form
          onSubmit={handleDiseaseDetection}
          noValidate
          className="p-6"
        >
          {!appData.selectedImage ? (
            <div className="border-2 border-dashed border-dark-border rounded-2xl p-12 flex flex-col items-center justify-center bg-dark-bg/50 hover:bg-dark-bg transition-colors cursor-pointer relative">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Upload className="text-stone-600 mb-2" size={32} />
              <p className="text-stone-400 text-sm font-medium">{t('disease.tapToUpload')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden aspect-square bg-dark-bg">
                <img src={appData.selectedImage} alt="Selected" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                <button 
                  type="button"
                  onClick={resetDiseaseResult}
                  className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm p-1.5 rounded-full"
                >
                  <X size={16} />
                </button>
              </div>
              <button 
                type="submit"
                disabled={appData.diseaseLoading}
                className="w-full bg-brand-green hover:bg-brand-green-dark text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center disabled:opacity-50"
              >
                {appData.diseaseLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : t('disease.startDiagnosis')}
              </button>
              {(appData.disease || appData.diseaseError) && (
                <button
                  type="button"
                  onClick={resetDiseaseResult}
                  className="w-full border border-dark-border text-stone-300 font-bold py-3 rounded-2xl transition-all hover:border-stone-500"
                >
                  New Upload
                </button>
              )}
            </div>
          )}
        </form>
      </div>
      {renderResult(appData.disease, appData.diseaseError, {
        onReset: resetDiseaseResult,
        resetLabel: 'Clear Diagnosis'
      })}
    </div>
  );

  const renderWeather = () => (
    <div className="space-y-6 pb-24">
      {/* Location Button */}
      <div className="space-y-3">

        <button 
          onClick={() => refreshLocation()}
          disabled={locationLoading}
          className="w-full bg-stone-800/50 hover:bg-stone-800 p-3 rounded-xl border border-dark-border flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
        >
          <MapPin size={14} className={cn(locationLoading ? "animate-pulse" : "text-brand-green")} />
          <span className="text-xs font-bold text-stone-300">
            {locationLoading ? "Detecting Location..." : location ? `Using: ${location.city || location.state}` : "Use My Current Location"}
          </span>
        </button>
      </div>

      {appData.weatherLoading ? (
        <div className="py-20 text-center">
          <div className="animate-pulse flex flex-col items-center">
            <RefreshCw size={48} className="text-stone-700 mb-4 animate-spin" />
            <p className="text-stone-500">Fetching weather data...</p>
          </div>
        </div>
      ) : appData.weatherError ? (
        <div className="bg-dark-card p-12 rounded-3xl border border-dark-border flex flex-col items-center justify-center text-center">
          <AlertCircle size={48} className="text-red-500/20 mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Weather Error</h3>
          <p className="text-stone-500 text-sm max-w-md mx-auto mb-6">{appData.weatherError}</p>
          <button 
            onClick={() => fetchWeather(appData.weatherCity)}
            className="px-6 py-2 bg-brand-green text-white rounded-xl font-bold text-sm"
          >
            Retry
          </button>
        </div>
      ) : appData.weather ? (
        <>
          <div className="bg-dark-card p-6 rounded-3xl border border-dark-border relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-green/10 rounded-full blur-3xl"></div>
            
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div>
                <h2 className="text-2xl font-bold">{appData.weather.city}</h2>
                <p className="text-stone-500 text-sm capitalize">{appData.weather.description}</p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold">{appData.weather.temp}°C</div>
                <p className="text-brand-green text-sm font-medium">{appData.weather.condition}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 relative z-10">
              <div className="bg-dark-bg/50 p-3 rounded-2xl border border-dark-border text-center">
                <Wind size={20} className="mx-auto text-stone-400 mb-1" />
                <div className="text-[10px] text-stone-500 uppercase font-bold">Wind</div>
                <div className="text-sm font-bold">{appData.weather.windSpeed} km/h</div>
              </div>
              <div className="bg-dark-bg/50 p-3 rounded-2xl border border-dark-border text-center">
                <Droplets size={20} className="mx-auto text-stone-400 mb-1" />
                <div className="text-[10px] text-stone-500 uppercase font-bold">Humidity</div>
                <div className="text-sm font-bold">{appData.weather.humidity}%</div>
              </div>
              <div className="bg-dark-bg/50 p-3 rounded-2xl border border-dark-border text-center">
                <Sun size={20} className="mx-auto text-stone-400 mb-1" />
                <div className="text-[10px] text-stone-500 uppercase font-bold">UV Index</div>
                <div className="text-sm font-bold">{appData.weather.uvIndex}</div>
              </div>
            </div>
          </div>

          {/* AI Advisory Layer */}
          <div className="bg-brand-green/10 border border-brand-green/20 p-6 rounded-3xl">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-brand-green rounded-lg flex items-center justify-center mr-3">
                <Sprout size={16} className="text-white" />
              </div>
              <h3 className="font-bold text-brand-green">AI Agricultural Insight</h3>
            </div>
            <div className="space-y-2">
              {appData.weather.insights.map((insight: string, i: number) => (
                <div key={i} className="flex items-start">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-green mr-2 shrink-0"></div>
                  <p className="text-stone-400 text-sm leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-bold mb-4">5-Day Forecast</h3>
            <div className="space-y-3">
              {appData.weather.forecast.map((day: any) => (
                <div key={day.date} className="bg-dark-card p-4 rounded-2xl border border-dark-border flex items-center justify-between">
                  <span className="font-medium text-stone-400 w-24">
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex items-center space-x-2">
                    <img 
                      src={`https://openweathermap.org/img/wn/${day.icon}.png`} 
                      alt={day.condition}
                      className="w-8 h-8"
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-sm">{day.condition}</span>
                  </div>
                  <div className="text-sm font-bold">
                    <span>{day.temp}°C</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="py-20 text-center">
          <div className="animate-pulse flex flex-col items-center">
            <CloudRain size={48} className="text-stone-700 mb-4" />
            <p className="text-stone-500">Loading weather data...</p>
          </div>
        </div>
      )}
    </div>
  );

  const renderPriceTrends = () => {
    const states = marketService.getStates();
    const districts = marketService.getDistricts(appData.marketFilters.state);

    return (
      <div className="space-y-6 pb-24">
        {/* Market Controls */}
        <div className="bg-dark-card p-6 rounded-3xl border border-dark-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center">
              <TrendingUp size={24} className="mr-2 text-brand-green" />
              {t('market.priceTrends')}
            </h2>
            <div className="flex items-center text-[10px] text-stone-500 font-bold uppercase">
              <RefreshCw size={12} className={cn("mr-1", appData.marketLoading && "animate-spin")} />
              Last updated: {lastMarketUpdate.toLocaleTimeString()}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" size={16} />
              <select 
                value={appData.marketFilters.state}
                onChange={(e) => handleMarketFilterChange({ state: e.target.value, district: 'All Districts' })}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm appearance-none"
              >
                {states.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="relative">
              <Map className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" size={16} />
              <select 
                value={appData.marketFilters.district}
                onChange={(e) => handleMarketFilterChange({ district: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm appearance-none"
              >
                {districts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" size={16} />
              <input 
                type="text" 
                placeholder="Search crops..." 
                value={appData.marketFilters.commodity}
                onChange={(e) => handleMarketFilterChange({ commodity: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
              />
            </div>
          </div>
        </div>

        {appData.marketLoading && (!appData.market || appData.market.length === 0) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-dark-card p-6 rounded-3xl border border-dark-border h-64 animate-pulse"></div>
            <div className="bg-dark-card p-6 rounded-3xl border border-dark-border h-64 animate-pulse"></div>
          </div>
        ) : appData.marketError ? (
          <div className="bg-dark-card p-12 rounded-3xl border border-dark-border flex flex-col items-center justify-center text-center">
            <AlertCircle size={48} className="text-red-500/20 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Market Data Error</h3>
            <p className="text-stone-500 text-sm max-w-md mx-auto mb-6">{appData.marketError}</p>
            <button 
              onClick={() => fetchMarketData()}
              className="px-6 py-2 bg-brand-green text-white rounded-xl font-bold text-sm"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Crop List */}
              <div className="lg:col-span-1 bg-dark-card rounded-3xl border border-dark-border overflow-hidden flex flex-col h-[500px]">
                <div className="p-4 border-b border-dark-border bg-dark-bg/30">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500">Live Prices</h3>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar">
                  {appData.market && appData.market.length > 0 ? (
                    appData.market.map((crop: any) => (
                      <button 
                        key={crop.id} 
                        onClick={() => updateModuleData('selectedMarketCrop', crop)}
                        className={cn(
                          "w-full flex items-center justify-between p-4 border-b border-dark-border last:border-0 hover:bg-white/5 transition-colors text-left",
                          appData.selectedMarketCrop?.id === crop.id && "bg-brand-green/10 border-l-4 border-l-brand-green"
                        )}
                      >
                        <div>
                          <div className="font-bold text-sm">{crop.commodity}</div>
                          <div className="text-[10px] text-stone-500 uppercase font-bold">{crop.market}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-sm">₹{crop.modal_price.toLocaleString()}</div>
                          <div className={cn(
                            "text-[10px] font-bold flex items-center justify-end", 
                            crop.trend > 0 ? "text-emerald-500" : "text-red-500"
                          )}>
                            {crop.trend > 0 ? <TrendingUpIcon size={10} className="mr-0.5" /> : <TrendingDownIcon size={10} className="mr-0.5" />}
                            {Math.abs(crop.trend)}%
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-8 text-center text-stone-500 text-sm italic">
                      No market data found for this selection.
                    </div>
                  )}
                </div>
              </div>

              {/* Visualization & Insights */}
              <div className="lg:col-span-2 space-y-6">
                {appData.selectedMarketCrop && appData.selectedMarketCrop.history && appData.selectedMarketCrop.history.length > 0 && (
                  <div className="bg-dark-card p-6 rounded-3xl border border-dark-border">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-xl font-bold">{appData.selectedMarketCrop.commodity} Price Trend</h3>
                        <p className="text-stone-500 text-xs">7-Day Historical Data (₹ per quintal)</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-brand-green">₹{appData.selectedMarketCrop.modal_price.toLocaleString()}</div>
                        <div className="text-[10px] text-stone-500 font-bold uppercase">Current Modal Price</div>
                      </div>
                    </div>
                    
                    <div className="h-64 w-full min-h-[256px]" style={{ height: 256 }}>
                      <ResponsiveContainer width="100%" height={256} minWidth={1} minHeight={1}>
                        <LineChart data={appData.selectedMarketCrop.history}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2d323d" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            stroke="#57534e" 
                            fontSize={10} 
                            tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                          />
                          <YAxis stroke="#57534e" fontSize={10} domain={['auto', 'auto']} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1a1d23', border: '1px solid #2d323d', borderRadius: '12px' }}
                            itemStyle={{ color: '#22c55e' }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="price" 
                            stroke="#22c55e" 
                            strokeWidth={3} 
                            dot={{ fill: '#22c55e', strokeWidth: 2 }} 
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Price Comparison */}
                {appData.market && appData.market.length > 0 && (
                  <div className="bg-dark-card p-6 rounded-3xl border border-dark-border">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500 mb-4">Price Comparison (₹/Quintal)</h3>
                    <div className="h-48 w-full min-h-[192px]" style={{ height: 192 }}>
                      <ResponsiveContainer width="100%" height={192} minWidth={1} minHeight={1}>
                        <BarChart data={appData.market.slice(0, 5)}>
                          <XAxis dataKey="commodity" stroke="#57534e" fontSize={10} />
                          <YAxis stroke="#57534e" fontSize={10} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1a1d23', border: '1px solid #2d323d', borderRadius: '12px' }}
                          />
                          <Bar dataKey="modal_price" radius={[4, 4, 0, 0]}>
                            {appData.market.slice(0, 5).map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#22c55e' : '#16a34a'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* AI Insights */}
                <div className="bg-brand-green/10 border border-brand-green/20 p-6 rounded-3xl">
                  <div className="flex items-center mb-3">
                    <div className="w-8 h-8 bg-brand-green rounded-lg flex items-center justify-center mr-3">
                      <TrendingUpIcon size={16} className="text-white" />
                    </div>
                    <h3 className="font-bold text-brand-green">AI Market Insight</h3>
                  </div>
                  <p className="text-stone-400 text-sm leading-relaxed italic">
                    {appData.priceTrends || "Analyzing market trends..."}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const toggleBookmark = (id: string) => {
    const newBookmarks = appData.learn.bookmarks.includes(id) 
      ? appData.learn.bookmarks.filter(b => b !== id) 
      : [...appData.learn.bookmarks, id];
    updateModuleData('learn', { ...appData.learn, bookmarks: newBookmarks });
  };

  const renderLearn = () => {
    if (appData.learn.selectedArticle) {
      return (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-6 pb-24"
        >
          <button 
            onClick={() => updateModuleData('learn', { ...appData.learn, selectedArticle: null })}
            className="flex items-center text-stone-400 hover:text-white transition-colors mb-4 group"
          >
            <ArrowLeft size={20} className="mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Learning Center
          </button>

          <div className="bg-dark-card rounded-3xl border border-dark-border overflow-hidden">
            <div className="h-64 relative">
              <img 
                src={appData.learn.selectedArticle.image} 
                alt={appData.learn.selectedArticle.title} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark-card via-transparent to-transparent"></div>
              <div className="absolute bottom-6 left-6 right-6">
                <span className="text-[10px] bg-brand-green text-white px-3 py-1 rounded-full font-bold uppercase tracking-wider mb-2 inline-block">
                  {appData.learn.selectedArticle.category}
                </span>
                <h2 className="text-3xl font-bold text-white">{appData.learn.selectedArticle.title}</h2>
              </div>
            </div>
            
            <div className="p-8">
              <div className="flex items-center space-x-4 mb-8 text-stone-500 text-sm">
                <span className="flex items-center">
                  <History size={14} className="mr-1" />
                  {appData.learn.selectedArticle.time}
                </span>
                <button 
                  onClick={() => toggleBookmark(appData.learn.selectedArticle.id)}
                  className="flex items-center hover:text-brand-green transition-colors"
                >
                  {appData.learn.bookmarks.includes(appData.learn.selectedArticle.id) ? (
                    <><BookmarkCheck size={14} className="mr-1 text-brand-green" /> Saved</>
                  ) : (
                    <><Bookmark size={14} className="mr-1" /> Save for later</>
                  )}
                </button>
              </div>

              <div className="prose prose-invert max-w-none">
                <div className="markdown-body text-stone-300 leading-relaxed space-y-4">
                  <Markdown>{appData.learn.selectedArticle.content}</Markdown>
                </div>
              </div>

              <div className="mt-12 pt-8 border-t border-dark-border">
                <h4 className="font-bold mb-4">Related Topics</h4>
                <div className="flex flex-wrap gap-2">
                  {articles
                    .filter(a => a.category === appData.learn.selectedArticle.category && a.id !== appData.learn.selectedArticle.id)
                    .slice(0, 3)
                    .map(related => (
                      <button 
                        key={related.id}
                        onClick={() => updateModuleData('learn', { ...appData.learn, selectedArticle: related })}
                        className="px-4 py-2 bg-dark-bg border border-dark-border rounded-xl text-xs hover:border-brand-green transition-colors"
                      >
                        {related.title}
                      </button>
                    ))
                  }
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    const filteredArticles = articles.filter(article => {
      const matchesSearch = article.title.toLowerCase().includes(appData.learn.searchQuery.toLowerCase()) ||
                          article.description.toLowerCase().includes(appData.learn.searchQuery.toLowerCase());
      const matchesCategory = appData.learn.selectedCategory === 'All' || article.category === appData.learn.selectedCategory;
      return matchesSearch && matchesCategory;
    });

    const categories = ['All', ...Array.from(new Set(articles.map(a => a.category)))];

    return (
      <div className="space-y-6 pb-24">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Learning Center</h2>
          <div className="flex items-center space-x-2 text-stone-500 text-sm">
            <BookOpen size={16} />
            <span>{articles.length} Articles</span>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" size={18} />
            <input 
              type="text" 
              placeholder="Search articles, techniques..." 
              value={appData.learn.searchQuery}
              onChange={(e) => updateModuleData('learn', { ...appData.learn, searchQuery: e.target.value })}
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-dark-card border border-dark-border text-sm focus:border-brand-green outline-none transition-colors"
            />
          </div>

          <div className="flex items-center space-x-2 overflow-x-auto pb-2 no-scrollbar">
            <Filter size={14} className="text-stone-500 shrink-0" />
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => updateModuleData('learn', { ...appData.learn, selectedCategory: cat })}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
                  appData.learn.selectedCategory === cat 
                    ? "bg-brand-green border-brand-green text-white" 
                    : "bg-dark-card border-dark-border text-stone-400 hover:border-stone-600"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Articles Grid */}
        <div className="grid grid-cols-1 gap-6">
          {filteredArticles.map((article) => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={article.id} 
              onClick={() => updateModuleData('learn', { ...appData.learn, selectedArticle: article })}
              className="bg-dark-card rounded-3xl border border-dark-border overflow-hidden group hover:shadow-2xl hover:shadow-brand-green/5 transition-all duration-300 cursor-pointer"
            >
              <div className="h-48 overflow-hidden relative">
                <img 
                  src={article.image} 
                  alt={article.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBookmark(article.id);
                  }}
                  className="absolute top-4 right-4 p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-brand-green transition-colors"
                >
                  {appData.learn.bookmarks.includes(article.id) ? (
                    <BookmarkCheck size={18} className="fill-current" />
                  ) : (
                    <Bookmark size={18} />
                  )}
                </button>
                <div className="absolute bottom-4 left-4">
                  <span className="text-[10px] bg-brand-green text-white px-3 py-1 rounded-full font-bold uppercase tracking-wider shadow-lg">
                    {article.category}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-[10px] text-stone-500 font-bold uppercase flex items-center">
                    <History size={12} className="mr-1" />
                    {article.time}
                  </span>
                </div>
                <h3 className="font-bold text-xl mb-2 group-hover:text-brand-green transition-colors">{article.title}</h3>
                <p className="text-stone-400 text-sm mb-6 line-clamp-2 leading-relaxed">
                  {article.description}
                </p>
                <div className="flex items-center justify-between">
                  <button className="flex items-center text-brand-green text-sm font-bold group/link">
                    Read Article 
                    <ArrowRight size={16} className="ml-1 group-hover/link:translate-x-1 transition-transform" />
                  </button>
                  {appData.learn.bookmarks.includes(article.id) && (
                    <span className="text-[10px] text-brand-green font-bold uppercase">Saved</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filteredArticles.length === 0 && (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-dark-card rounded-full flex items-center justify-center mx-auto mb-4 border border-dark-border">
              <Search size={24} className="text-stone-600" />
            </div>
            <p className="text-stone-500 font-medium">No articles found matching your search.</p>
            <button 
              onClick={() => {
                updateModuleData('learn', { ...appData.learn, searchQuery: '', selectedCategory: 'All' });
              }}
              className="mt-4 text-brand-green text-sm font-bold"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderResult = (
    result: any,
    error: string | null = null,
    options?: { onReset?: () => void; resetLabel?: string }
  ) => (
    <AnimatePresence>
      {(result || error) && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          {error ? (
            <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl flex items-start">
              <AlertCircle className="text-red-500 mr-4 shrink-0" />
              <div>
                <h3 className="text-red-500 font-bold">Error</h3>
                <p className="text-red-400 text-sm mt-1">{error}</p>
              </div>
            </div>
          ) : result && (
            <div className={cn(
              "p-6 rounded-3xl border",
              result.confidence < 0.8 ? "bg-amber-500/10 border-amber-500/20" : "bg-brand-green/10 border-brand-green/20"
            )}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  {result.confidence < 0.8 ? (
                    <AlertCircle className="text-amber-500 mr-2" />
                  ) : (
                    <CheckCircle2 className="text-brand-green mr-2" />
                  )}
                  <h3 className={cn(
                    "text-xl font-bold",
                    result.confidence < 0.8 ? "text-amber-500" : "text-brand-green"
                  )}>
                    {result.result}
                  </h3>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-stone-500">Confidence</div>
                  <div className="text-lg font-bold">{(result.confidence * 100).toFixed(1)}%</div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-stone-300">Recommendations:</h4>
                <div className="grid grid-cols-1 gap-2">
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className="bg-dark-bg/50 p-3 rounded-xl border border-dark-border text-stone-400 text-xs leading-relaxed">
                      {rec}
                    </div>
                  ))}
                </div>
              </div>

              {options?.onReset && (
                <button
                  type="button"
                  onClick={options.onReset}
                  className="mt-5 w-full rounded-2xl border border-dark-border px-4 py-3 text-sm font-bold text-stone-300 transition-colors hover:border-stone-500"
                >
                  {options.resetLabel || 'Clear Result'}
                </button>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderGis = () => {
    return (
      <div className="flex flex-col w-full pb-24 px-4 md:px-6 pt-4 space-y-6">
        {/* Top Map Section - Full Page Width with Rounded Border */}
        <div className="w-full h-[65vh] min-h-[500px] relative">
          <FarmMap onBoundaryCreated={setMapBoundary} />
        </div>
        
        {/* Bottom Dashboard / Results Section */}
        <div className="w-full max-w-7xl mx-auto">
          <CropHealthDashboard geoJson={mapBoundary} />
        </div>
      </div>
    );
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navItems = [
    { id: 'home', icon: Home, label: t('common.home') },
    { id: 'advisor', icon: Sprout, label: t('common.advisor') },
    { id: 'fertilizer', icon: FlaskConical, label: t('common.fertilizer') },
    { id: 'disease', icon: Bug, label: t('common.disease') },
    { id: 'gis', icon: Map, label: 'Satellite Map' },
    { id: 'weather', icon: CloudRain, label: t('common.weather') },
    { id: 'priceTrends', icon: TrendingUp, label: t('common.priceTrends') },
    { id: 'learn', icon: BookOpen, label: t('common.learn') },
    { id: 'history', icon: History, label: t('common.history') },
    { id: 'profile', icon: User, label: t('common.profile') },
  ];

  const handleNavClick = (id: string) => {
    if (id === 'history') {
      setShowHistory(true);
    } else {
      switchTab(id as Tab);
    }
    setMobileMenuOpen(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500" size={32} />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="relative min-h-screen bg-dark-bg text-stone-200 font-sans selection:bg-brand-green/30 overflow-x-hidden">
      {/* Full-bleed Atmospheric Background Image */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.img
            key={heroIndex}
            src={HERO_CONTENT[heroIndex].image}
            alt="Atmospheric Farm Background"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 0.35, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="w-full h-full object-cover filter saturate-[1.25] brightness-90"
            referrerPolicy="no-referrer"
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-b from-stone-950/85 via-stone-950/75 to-stone-950/95 backdrop-blur-[3px]" />
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      </div>

      {/* Header with Hamburger */}
      <header className="fixed top-0 left-0 right-0 h-20 bg-stone-950/80 backdrop-blur-2xl border-b border-stone-800/80 z-40 px-4 md:px-6 flex items-center justify-between shadow-xl shadow-black/40">
        <div className="flex items-center space-x-3">
          {/* Hamburger Toggle */}
          <button
            onClick={() => {
              if (window.innerWidth < 768) {
                setMobileMenuOpen(!mobileMenuOpen);
              } else {
                setSidebarCollapsed(!sidebarCollapsed);
              }
            }}
            className="p-2.5 rounded-xl bg-stone-900/80 border border-stone-700/80 text-stone-300 hover:text-white hover:border-emerald-500/50 transition-all active:scale-95"
            title="Toggle Navigation Menu"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center space-x-3 cursor-pointer select-none" onClick={handleLogoSecretClick} title="AgroShield">
            <Logo size={36} />
            <div className="flex flex-col">
              <h1 className="font-bold text-lg md:text-xl tracking-tight leading-none text-white hover:text-brand-green transition-colors">
                Smart Agriculture
              </h1>
              <div className="flex items-center mt-1">
                <span className="text-[10px] font-medium text-stone-400 uppercase tracking-[0.15em] hidden sm:inline">
                  AI Powered Farming Intelligence
                </span>
                {user?.id?.startsWith('demo-user') && (
                  <span className="ml-2 text-[8px] font-bold bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-md uppercase tracking-wider border border-amber-500/30">
                    Demo Mode
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <LanguageSelector />
          <div className="relative"
            onMouseEnter={() => { if (!user?.location || user?.location === 'General' || !user?.farmType) setShowDotTooltip(true); }}
            onMouseLeave={() => setShowDotTooltip(false)}
          >
            <button 
              onClick={() => switchTab('profile')}
              className={cn(
                "w-9 h-9 rounded-full bg-stone-800/80 flex items-center justify-center border border-stone-700/80 overflow-hidden transition-all shadow-md",
                activeTab === 'profile' ? "border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-400" : "hover:border-stone-500 text-stone-300"
              )}
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt={user.name || 'User'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : user?.name ? (
                <span className="text-xs font-bold text-emerald-400">{user.name.charAt(0)}</span>
              ) : (
                <User size={18} className="text-stone-400" />
              )}
            </button>
            {/* Pulsing glow dot — hover triggers tooltip below header */}
            {showProfileSidePopup && (!user?.location || user?.location === 'General' || !user?.farmType) && (
              <div
                className="absolute -top-0.5 -right-0.5 z-50"
                onMouseEnter={() => setShowDotTooltip(true)}
                onMouseLeave={() => setShowDotTooltip(false)}
              >
                {/* The pulsing dot — large enough to be hovered easily */}
                <span className="flex h-4 w-4 cursor-pointer items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-stone-950"></span>
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* YouTube-Style Left Sidebar (Desktop View) */}
      <aside className={cn(
        "hidden md:flex flex-col fixed top-20 left-0 bottom-0 z-30 bg-stone-950/75 backdrop-blur-2xl border-r border-stone-800/80 shadow-2xl transition-all duration-300 p-3 space-y-2 overflow-y-auto scrollbar-none",
        sidebarCollapsed ? "w-20" : "w-64"
      )}>
        <div className="space-y-1.5 pt-2">
          {navItems.map((item) => {
            const isActive = item.id === 'history' ? showHistory : activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={cn(
                  "w-full flex items-center rounded-2xl px-3.5 py-3 transition-all duration-200 group",
                  sidebarCollapsed ? "justify-center" : "space-x-3.5",
                  isActive
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold shadow-lg shadow-emerald-500/10"
                    : "text-stone-400 hover:text-white hover:bg-stone-900/60 border border-transparent"
                )}
                title={item.label}
              >
                <item.icon size={20} className={cn("flex-shrink-0 transition-transform duration-200", isActive && "scale-110 text-emerald-400")} />
                {!sidebarCollapsed && (
                  <span className="text-sm tracking-wide truncate">{item.label}</span>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Mobile Slide-Over Drawer (Hamburger Menu) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="md:hidden fixed top-0 left-0 bottom-0 w-72 bg-stone-950/95 backdrop-blur-2xl border-r border-stone-800/80 z-50 p-6 flex flex-col justify-between shadow-2xl overflow-y-auto"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-stone-800 pb-4">
                  <div className="flex items-center space-x-3">
                    <Logo size={36} />
                    <span className="font-bold text-lg text-white">Smart Agri</span>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-2">
                  {navItems.map((item) => {
                    const isActive = item.id === 'history' ? showHistory : activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={cn(
                          "w-full flex items-center space-x-4 px-4 py-3.5 rounded-2xl transition-all font-medium text-sm",
                          isActive
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold shadow-lg shadow-emerald-500/10"
                            : "text-stone-300 hover:text-white hover:bg-stone-900/60"
                        )}
                      >
                        <item.icon size={22} className={cn(isActive && "text-emerald-400")} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {user && (
                <div className="pt-6 border-t border-stone-800 flex items-center justify-between">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="w-10 h-10 shrink-0 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-400">
                      {user.name ? user.name.charAt(0) : <User size={18} />}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-bold text-white truncate">{user.name || 'User'}</span>
                      <span className="text-xs text-stone-400 truncate">{user.identifier}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowApiKeyModal(true)}
                    title="Private Admin Vault"
                    className="p-1.5 text-stone-600 hover:text-amber-400 opacity-20 hover:opacity-100 transition-opacity cursor-pointer rounded-lg hover:bg-stone-800/60"
                  >
                    <Lock size={12} />
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <LocationBanner 
        show={showLocationBanner} 
        onClose={() => setShowLocationBanner(false)} 
        error={locationError}
        denied={locationDenied}
      />

      {/* Main Content (Padded for Left Sidebar on Desktop) */}
      <main className={cn(
        "relative z-10 pt-20 transition-all duration-300",
        sidebarCollapsed ? "md:pl-20" : "md:pl-64"
      )}>
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          {/* Home & GIS tabs: full-width edge-to-edge */}
          <TabPanel active={activeTab === 'home'}>{renderHome()}</TabPanel>
          <TabPanel active={activeTab === 'gis'}>{renderGis()}</TabPanel>

          {/* All other tabs: padded and max-width constrained */}
          <div className={cn(
            "px-4 md:px-8 pt-8 md:pt-10 pb-16",
            (activeTab === 'home' || activeTab === 'gis') && "hidden"
          )}>
            <div className={cn(
              "mx-auto",
              activeTab === 'fertilizer' ? "max-w-7xl" : "max-w-4xl"
            )}>
              <TabPanel active={activeTab === 'advisor'}>{renderAdvisor()}</TabPanel>
              <TabPanel active={activeTab === 'fertilizer'}>
                <FertilizerRecommendation />
              </TabPanel>
              <TabPanel active={activeTab === 'disease'}>{renderDisease()}</TabPanel>
              <TabPanel active={activeTab === 'weather'}>{renderWeather()}</TabPanel>
              <TabPanel active={activeTab === 'priceTrends'}>{renderPriceTrends()}</TabPanel>
              <TabPanel active={activeTab === 'learn'}>{renderLearn()}</TabPanel>
              <TabPanel active={activeTab === 'profile'}><ProfileSettings /></TabPanel>
            </div>
          </div>
        </motion.div>
      </main>

      <HistoryModal open={showHistory} onClose={() => setShowHistory(false)} />
      <ApiKeyModal isOpen={showApiKeyModal} onClose={() => setShowApiKeyModal(false)} />

      {/* Profile dot tooltip — fixed below header, shown on dot hover */}
      <AnimatePresence>
        {showDotTooltip && showProfileSidePopup && (!user?.location || user?.location === 'General' || !user?.farmType) && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed top-[72px] right-4 md:right-6 w-72 z-[60]"
            onMouseEnter={() => setShowDotTooltip(true)}
            onMouseLeave={() => setShowDotTooltip(false)}
          >
            <div className="bg-stone-900/98 backdrop-blur-2xl border border-emerald-500/30 rounded-2xl p-4 shadow-2xl shadow-black/80">
              {/* Arrow pointing up */}
              <div className="absolute -top-1.5 right-5 w-3 h-3 bg-stone-900 border-t border-l border-emerald-500/30 rotate-45"></div>
              <div className="flex items-start space-x-2.5 mb-3">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                  <MapPin size={14} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white leading-tight">Complete Your Profile</h4>
                  <p className="text-[10px] text-stone-400 mt-0.5 leading-relaxed">Add your location & farm type to get personalised crop advice, weather alerts and market prices.</p>
                </div>
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="e.g. Wardha, Maharashtra"
                  value={popupLocation}
                  onChange={(e) => setPopupLocation(e.target.value)}
                  className="w-full bg-stone-950/80 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-emerald-500"
                />
                <select
                  value={popupFarmType}
                  onChange={(e) => setPopupFarmType(e.target.value)}
                  className="w-full bg-stone-950/80 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Organic">Organic Farming</option>
                  <option value="Conventional">Conventional Crop</option>
                  <option value="Horticulture">Horticulture & Fruits</option>
                  <option value="Mixed">Mixed Agriculture</option>
                </select>
                <div className="flex space-x-2 pt-0.5">
                  <button
                    onClick={handleSaveProfilePopup}
                    disabled={savingPopup}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs py-2 rounded-xl transition-all shadow-md shadow-emerald-500/20 active:scale-95"
                  >
                    {savingPopup ? 'Saving...' : 'Save & Update'}
                  </button>
                  <button
                    onClick={() => { setShowProfileSidePopup(false); setShowDotTooltip(false); }}
                    className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white text-xs font-semibold rounded-xl transition-all"
                    title="Dismiss"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ChatWidget />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  );
}
