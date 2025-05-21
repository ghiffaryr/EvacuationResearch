import { create } from 'zustand'

interface AppState {
  // Simulation state
  currentSimulation: {
    type: 'microscopic' | 'mesoscopic' | 'macroscopic' | null
    data: any | null
    isLoading: boolean
  }
  
  // Training state
  trainingStatus: {
    isTraining: boolean
    progress: number
    modelId: string | null
    error: string | null
  }
  
  // Actions
  setSimulation: (type: 'microscopic' | 'mesoscopic' | 'macroscopic' | null, data: any) => void
  setSimulationLoading: (isLoading: boolean) => void
  setTrainingStatus: (status: Partial<AppState['trainingStatus']>) => void
}

export const useStore = create<AppState>((set) => ({
  // Initial state
  currentSimulation: {
    type: null,
    data: null,
    isLoading: false
  },
  
  trainingStatus: {
    isTraining: false,
    progress: 0,
    modelId: null,
    error: null
  },
  
  // Actions
  setSimulation: (type, data) => set(state => ({
    currentSimulation: {
      ...state.currentSimulation,
      type,
      data
    }
  })),
  
  setSimulationLoading: (isLoading) => set(state => ({
    currentSimulation: {
      ...state.currentSimulation,
      isLoading
    }
  })),
  
  setTrainingStatus: (status) => set(state => ({
    trainingStatus: {
      ...state.trainingStatus,
      ...status
    }
  }))
}))
