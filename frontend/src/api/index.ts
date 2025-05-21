import axios from "axios";

export interface ScenarioType {
  id: string;
  name: string;
  description: string;
  type: string;
}

export interface TrainingOptions {
  modelType: string;
  gridSize: number;
  numAgents: number;
  episodes: number;
  useFairness: boolean;
  useGPU: boolean;
}

export interface TrainingResults {
  rewards: number[];
  evacuation_times: number[];
  gini_history?: number[];
}

export async function fetchScenarios(): Promise<ScenarioType[]> {
  try {
    console.log("Fetching scenarios...");
    const response = await axios.get("/api/scenarios");
    console.log("Scenarios response:", response.data);
    return response.data.scenarios || [];
  } catch (error) {
    console.error("Error fetching scenarios:", error);
    throw error;
  }
}

export async function fetchScenario(id: string): Promise<any> {
  try {
    const response = await axios.get(`/api/scenarios/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching scenario ${id}:`, error);
    throw error;
  }
}

export async function startTrainingScenario(
  scenarioId: string,
  options: TrainingOptions
): Promise<TrainingResults> {
  try {
    console.log(
      `Starting training with scenario ${scenarioId} and options:`,
      options
    );

    const response = await axios.post(`/api/train/${options.modelType}`, {
      scenario_id: scenarioId,
      grid_size: options.gridSize,
      num_agents: options.numAgents,
      episodes: options.episodes,
      use_fairness: options.useFairness,
      use_gpu: options.useGPU,
    });

    console.log("Training response:", response.data);

    if (response.data && response.data.results) {
      return response.data.results;
    } else {
      throw new Error("Invalid response format from training API");
    }
  } catch (error) {
    console.error("Training error:", error);
    throw error;
  }
}
