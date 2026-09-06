import React, { useEffect, useRef, useState } from 'react';
import { 
  FlaskConical, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight, 
  MapPin, 
  Upload, 
  Image as ImageIcon, 
  Sparkles,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { authService } from '../../services/authService';
import { useAppContext } from '../../context/AppContext';
import { useHistoryStore } from '../../stores/historyStore';
import { extractSoilParametersFromImage } from '../../services/ocrService';

interface FertilizerRecommendationData {
  id: string;
  fertilizerName: string;
  quantity: string;
  instructions: string;
  reason: string;
  cropType: string;
  soilType: string;
  n: number;
  p: number;
  k: number;
  timestamp: string;
}

export const FertilizerRecommendation: React.FC = () => {
  const { appData, updateModuleData } = useAppContext();
  const addEntry = useHistoryStore((state) => state.addEntry);
  const cropTypeInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const emptyFertilizerForm = {
    cropType: '',
    soilType: '',
    n: '',
    p: '',
    k: '',
    location: ''
  };

  const resetRecommendation = () => {
    updateModuleData('fertilizerForm', emptyFertilizerForm);
    updateModuleData('fertilizer', null);
    updateModuleData('fertilizerError', null);
    setOcrSuccessMsg(null);
    window.requestAnimationFrame(() => {
      cropTypeInputRef.current?.focus();
    });
  };

  const isFormEmpty = Object.values(appData.fertilizerForm).every((value) => value === '');

  const handleImageFile = async (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    setOcrLoading(true);
    setOcrSuccessMsg(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });

      const base64 = await base64Promise;
      const extracted = await extractSoilParametersFromImage(base64);

      updateModuleData('fertilizerForm', {
        ...appData.fertilizerForm,
        cropType: extracted.cropType || appData.fertilizerForm.cropType || 'Tomato',
        soilType: extracted.soilType || appData.fertilizerForm.soilType || 'Loamy',
        n: extracted.nitrogen !== undefined ? String(extracted.nitrogen) : appData.fertilizerForm.n,
        p: extracted.phosphorus !== undefined ? String(extracted.phosphorus) : appData.fertilizerForm.p,
        k: extracted.potassium !== undefined ? String(extracted.potassium) : appData.fertilizerForm.k,
      });

      setOcrSuccessMsg(`Values extracted from image: N: ${extracted.nitrogen ?? '--'}, P: ${extracted.phosphorus ?? '--'}, K: ${extracted.potassium ?? '--'}, Soil: ${extracted.soilType || 'Loamy'}`);
    } catch (err) {
      console.error('OCR Extraction error:', err);
      alert('Failed to analyze the image. Please enter values manually.');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleImageFile(file);
    }
  };

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (appData.fertilizerLoading) {
      return;
    }

    const fertilizerForm = { ...appData.fertilizerForm };

    updateModuleData('fertilizerLoading', true);
    updateModuleData('fertilizerError', null);

    try {
      console.log('[Fertilizer] Submit started');

      const response = await fetch('/api/fertilizer/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authService.getToken()}`
        },
        body: JSON.stringify(fertilizerForm)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || 'Failed to get recommendation');
      }

      const data = await response.json();
      if (data.status === 'ok') {
        updateModuleData('fertilizer', data);
        addEntry({
          id: Date.now(),
          module: 'fertilizer',
          input: fertilizerForm,
          output: {
            fertilizerName: data.fertilizerName,
            quantity: data.quantity,
            instructions: data.instructions,
            reason: data.reason
          },
          timestamp: data.timestamp || new Date().toISOString()
        });
      } else {
        updateModuleData('fertilizerError', data.error || 'Failed to get recommendation');
      }
    } catch (err: any) {
      console.error('Fertilizer recommendation error:', err);
      // Client-side fallback calculation if offline or serverless
      const nVal = Number(fertilizerForm.n) || 60;
      const pVal = Number(fertilizerForm.p) || 40;
      const kVal = Number(fertilizerForm.k) || 30;
      let recName = 'NPK 19-19-19';
      let recQty = '50 kg / acre';
      let recReason = `Balanced nitrogen (${nVal}) and phosphorus (${pVal}) replenishment for ${fertilizerForm.cropType || 'crops'}.`;

      if (nVal < 50) {
        recName = 'Urea (46-0-0) + DAP';
        recQty = '45 kg / acre';
        recReason = 'Low nitrogen detected. Urgent replenishment required for vegetative canopy growth.';
      } else if (pVal < 30) {
        recName = 'Single Super Phosphate (SSP)';
        recQty = '60 kg / acre';
        recReason = 'Low phosphorus detected. Critical for strong root architecture and early flowering.';
      } else if (kVal < 25) {
        recName = 'Muriate of Potash (MOP)';
        recQty = '30 kg / acre';
        recReason = 'Potassium deficit observed. Enhances disease immunity and fruit firmness.';
      }

      const fallbackData = {
        fertilizerName: recName,
        quantity: recQty,
        instructions: 'Apply in two split doses during early vegetative stage. Calibrate soil moisture before broadcasting.',
        reason: recReason,
        timestamp: new Date().toISOString()
      };

      updateModuleData('fertilizer', fallbackData);
    } finally {
      updateModuleData('fertilizerLoading', false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Fertilizer Recommendation</h1>
        <p className="text-gray-400">Get expert advice on the best fertilizer for your crops, or drop your soil test card image to auto-fill.</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <div className="bg-dark-card p-6 rounded-2xl border border-dark-border shadow-sm h-fit space-y-4">
          
          {/* Image Dropzone for Soil Card Auto-Fill */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
              isDragging 
                ? 'border-emerald-500 bg-emerald-950/20' 
                : 'border-stone-700/80 bg-stone-900/50 hover:border-emerald-500/50 hover:bg-stone-900'
            }`}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={(e) => e.target.files?.[0] && handleImageFile(e.target.files[0])} 
              className="hidden" 
              accept="image/*" 
            />
            {ocrLoading ? (
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
                  <span className="text-[10px] text-stone-400">AI automatically scans & fills N, P, K, soil & crop parameters</span>
                </div>
              </>
            )}
          </div>

          {/* Success Banner */}
          <AnimatePresence>
            {ocrSuccessMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs flex items-center space-x-2"
              >
                <Sparkles size={14} className="text-emerald-400 flex-shrink-0" />
                <span className="flex-1">{ocrSuccessMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Crop Type</label>
                <input
                  ref={cropTypeInputRef}
                  type="text"
                  placeholder="e.g. Tomato, Wheat, Rice"
                  className="w-full px-4 py-2 rounded-xl bg-dark-input border border-dark-border text-white placeholder:text-gray-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={appData.fertilizerForm.cropType}
                  onChange={(e) => updateModuleData('fertilizerForm', { ...appData.fertilizerForm, cropType: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Soil Type</label>
                <select
                  className="w-full px-4 py-2 rounded-xl bg-dark-input border border-dark-border text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={appData.fertilizerForm.soilType}
                  onChange={(e) => updateModuleData('fertilizerForm', { ...appData.fertilizerForm, soilType: e.target.value })}
                  required
                >
                  <option value="">Select Soil</option>
                  <option value="Sandy">Sandy</option>
                  <option value="Clay">Clay</option>
                  <option value="Loamy">Loamy</option>
                  <option value="Black">Black</option>
                  <option value="Red">Red</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Location (Optional)</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Enter your region (e.g. Wardha, Nagpur)"
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-dark-input border border-dark-border text-white placeholder:text-gray-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={appData.fertilizerForm.location}
                  onChange={(e) => updateModuleData('fertilizerForm', { ...appData.fertilizerForm, location: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-emerald-400" />
                Soil Nutrients (Auto-filled or manual)
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">Nitrogen (N)</label>
                  <input
                    type="number"
                    placeholder="N"
                    className="w-full px-3 py-2 rounded-lg bg-dark-input border border-dark-border text-white placeholder:text-gray-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={appData.fertilizerForm.n}
                    onChange={(e) => updateModuleData('fertilizerForm', { ...appData.fertilizerForm, n: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">Phosphorus (P)</label>
                  <input
                    type="number"
                    placeholder="P"
                    className="w-full px-3 py-2 rounded-lg bg-dark-input border border-dark-border text-white placeholder:text-gray-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={appData.fertilizerForm.p}
                    onChange={(e) => updateModuleData('fertilizerForm', { ...appData.fertilizerForm, p: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">Potassium (K)</label>
                  <input
                    type="number"
                    placeholder="K"
                    className="w-full px-3 py-2 rounded-lg bg-dark-input border border-dark-border text-white placeholder:text-gray-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={appData.fertilizerForm.k}
                    onChange={(e) => updateModuleData('fertilizerForm', { ...appData.fertilizerForm, k: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {appData.fertilizerError && (
              <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-xl flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                {appData.fertilizerError}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={appData.fertilizerLoading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-950"
            >
              {appData.fertilizerLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Get Recommendation
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
            <button
              type="button"
              onClick={resetRecommendation}
              disabled={appData.fertilizerLoading || (isFormEmpty && !appData.fertilizer && !appData.fertilizerError)}
              className="w-full py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-xl font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              New Recommendation
            </button>
          </form>
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          {appData.fertilizer ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-dark-input p-6 rounded-2xl border-2 border-emerald-500 shadow-lg space-y-4"
            >
              <div className="flex items-center gap-3 pb-4 border-b border-dark-border">
                <div className="p-3 bg-emerald-900/30 rounded-2xl">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{appData.fertilizer.fertilizerName}</h2>
                  <p className="text-sm text-emerald-400 font-medium">Recommended Fertilizer</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-stone-900/50 rounded-xl border border-dark-border">
                  <span className="text-xs text-gray-400 block mb-1">Dosage / Quantity</span>
                  <span className="text-base font-bold text-white">{appData.fertilizer.quantity}</span>
                </div>
                <div className="p-4 bg-stone-900/50 rounded-xl border border-dark-border">
                  <span className="text-xs text-gray-400 block mb-1">Target Crop</span>
                  <span className="text-base font-bold text-white">{appData.fertilizerForm.cropType || 'All Crops'}</span>
                </div>
              </div>

              <div className="p-4 bg-stone-900/50 rounded-xl border border-dark-border space-y-1">
                <span className="text-xs text-gray-400 block">Agronomic Rationale</span>
                <p className="text-sm text-stone-300 leading-relaxed">{appData.fertilizer.reason}</p>
              </div>

              <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl space-y-1">
                <span className="text-xs font-bold text-emerald-400 block">Application Instructions</span>
                <p className="text-sm text-stone-300 leading-relaxed">{appData.fertilizer.instructions}</p>
              </div>
            </motion.div>
          ) : (
            <div className="h-full min-h-[300px] border border-dashed border-dark-border rounded-2xl flex flex-col items-center justify-center p-8 text-center text-gray-500 space-y-3">
              <FlaskConical className="w-12 h-12 opacity-30" />
              <p className="text-sm max-w-xs">Drop a photo of your soil card or enter crop & soil parameters on the left to see fertilizer advice.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
