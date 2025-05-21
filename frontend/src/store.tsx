import { createContext, useContext, ReactNode, useState } from "react";

// Define the shape of our store
interface StoreContextType {
  // Add your global state properties here
  darkMode: boolean;
  toggleDarkMode: () => void;

  // Training status tracking
  trainingStatus: {
    isTraining: boolean;
    progress: number;
    modelId: string | null;
    error: string | null;
  };
  setTrainingStatus: (status: {
    isTraining: boolean;
    progress: number;
    modelId: string | null;
    error: string | null;
  }) => void;
}

// Create context with default values
const StoreContext = createContext<StoreContextType>({
  darkMode: false,
  toggleDarkMode: () => {},
  trainingStatus: {
    isTraining: false,
    progress: 0,
    modelId: null,
    error: null,
  },
  setTrainingStatus: () => {},
});

// Custom hook to access the store
export function useStore() {
  return useContext(StoreContext);
}

// Provider component to wrap the app
export function StoreProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState(false);
  const [trainingStatus, setTrainingStatusState] = useState({
    isTraining: false,
    progress: 0,
    modelId: null as string | null,
    error: null as string | null,
  });

  const toggleDarkMode = () => {
    setDarkMode((prevMode) => !prevMode);
  };

  const setTrainingStatus = (status: {
    isTraining: boolean;
    progress: number;
    modelId: string | null;
    error: string | null;
  }) => {
    setTrainingStatusState(status);
  };

  // Create the value object to be provided to consumers
  const value = {
    darkMode,
    toggleDarkMode,
    trainingStatus,
    setTrainingStatus,
  };

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}
