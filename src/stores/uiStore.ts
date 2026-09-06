import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { FarmAnalysisResult } from '../services/bioIntelligence';

export type UIActiveTab =
  | 'home'
  | 'advisor'
  | 'fertilizer'
  | 'disease'
  | 'marketplace'
  | 'weather'
  | 'priceTrends'
  | 'learn'
  | 'profile'
  | 'gis';

interface UIStore {
  showHistory: boolean;
  activeTab: UIActiveTab;
  activeAnalysis: FarmAnalysisResult | null;
  setShowHistory: (value: boolean) => void;
  setActiveTab: (value: UIActiveTab) => void;
  setActiveAnalysis: (analysis: FarmAnalysisResult | null) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      showHistory: false,
      activeTab: 'home',
      activeAnalysis: null,
      setShowHistory: (value) => set({ showHistory: value }),
      setActiveTab: (value) => set({ activeTab: value }),
      setActiveAnalysis: (analysis) => set({ activeAnalysis: analysis }),
    }),
    {
      name: 'agri-ui-state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        showHistory: state.showHistory,
        activeTab: state.activeTab,
        activeAnalysis: state.activeAnalysis,
      }),
    }
  )
);

