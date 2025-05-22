import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Grid,
  CircularProgress,
  Select,
  MenuItem,
  Button,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  Tab,
  Tabs,
  Alert,
} from "@mui/material";
import axios from "axios";
import MicroscopicView from "../components/visualization/MicroscopicView";
import MesoscopicView from "../components/visualization/MesoscopicView";
import MacroscopicView from "../components/visualization/MacroscopicView";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// Define a more comprehensive hazard type
interface SimulationHazard {
  position: number[];
  type: string;
  radius: number;
  intensity: number;
  dimensions?: [number, number];
  is_transparent?: boolean;
  is_open?: boolean;
  texture?: string;
  height?: number;
  spread_rate?: number;
  duration?: number;
  aftershocks?: boolean;
  rise_rate?: number;
  flow_direction?: [number, number];
  cause?: string;
  is_debris?: boolean;
}

export default function SimulationPage() {
  const [loading, setLoading] = useState(false);
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [selectedScenario, setSelectedScenario] = useState("");
  const [simulationType, setSimulationType] = useState<
    "microscopic" | "mesoscopic" | "macroscopic"
  >("microscopic");
  const [tabValue, setTabValue] = useState(0);
  const [microscopicData, setMicroscopicData] = useState<any>(null);
  const [mesoscopicData, setMesoscopicData] = useState<any>(null);
  const [macroscopicData, setMacroscopicData] = useState<any>(null);
  const [error, setError] = useState("");
  const [parameterPresets, setParameterPresets] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState("standard");

  useEffect(() => {
    // Load available scenarios
    const fetchScenarios = async () => {
      try {
        const response = await axios.get("/api/scenarios");
        setScenarios(response.data.scenarios || []);
      } catch (err) {
        console.error("Error fetching scenarios:", err);
        setError("Failed to load scenarios");
      }
    };

    fetchScenarios();
  }, []);

  useEffect(() => {
    // Load parameter presets when simulation type changes
    const fetchParameterPresets = async () => {
      try {
        const response = await axios.get(`/api/simulate/${simulationType}`);
        if (response.data && response.data.available_presets) {
          setParameterPresets(response.data.available_presets);
          setSelectedPreset("standard");
        }
      } catch (err) {
        console.error(
          `Error fetching ${simulationType} parameter presets:`,
          err
        );
      }
    };

    fetchParameterPresets();
  }, [simulationType]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);

    // Set simulation type based on tab
    switch (newValue) {
      case 0:
        setSimulationType("microscopic");
        break;
      case 1:
        setSimulationType("mesoscopic");
        break;
      case 2:
        setSimulationType("macroscopic");
        break;
    }
  };

  const handleScenarioChange = (event: SelectChangeEvent) => {
    setSelectedScenario(event.target.value as string);
  };

  const runSimulation = async () => {
    if (!selectedScenario) {
      setError("Please select a scenario");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Fetch scenario details
      const scenarioResponse = await axios.get(
        `/api/scenarios/${selectedScenario}`
      );
      const scenarioData = scenarioResponse.data;

      // Fetch parameter preset
      const presetResponse = await axios.get(
        `/api/simulate/${simulationType}`,
        {
          params: { preset: selectedPreset },
        }
      );
      const presetParams = presetResponse.data.parameters || {};

      // Run the simulation with the selected type
      const simulationResponse = await axios.post(
        `/api/simulate/${simulationType}`,
        {
          building_layout: scenarioData.building_layout,
          hazards: scenarioData.hazards || [],
          num_agents:
            presetParams.agent_count || scenarioData.num_agents || 100,
          time_steps: scenarioData.time_steps || 100,
          grid_size: presetParams.grid_size || 50,
          grid_resolution: presetParams.grid_resolution || 100,
          panic_factor:
            presetParams.panic_factor || scenarioData.panic_factor || 1.2,
          density_threshold: presetParams.density_threshold || 3.5,
          diffusion_coefficient: presetParams.diffusion_coefficient || 0.8,
          fire_spread_rate: presetParams.fire_spread_rate || 0.0,
          evacuation_coefficient: presetParams.evacuation_coefficient || 1.0,
        }
      );

      // Store the simulation results based on the type
      if (simulationType === "microscopic") {
        // Format data for MicroscopicView
        const positionHistory = simulationResponse.data.results.positions;
        const velocityHistory = simulationResponse.data.results.velocities;
        const timeSteps = positionHistory.length;

        // Transform walls and exits to the format expected by MicroscopicView
        const walls = scenarioData.building_layout.walls.map((wall: any) => ({
          start: [...wall[0], 0], // Add z coordinate
          end: [...wall[1], 0],
        }));

        const exits = scenarioData.building_layout.exits.map((exit: any) => ({
          position: [...exit, 0], // Add z coordinate
          size: 1.0,
        }));

        // Transform hazards
        const hazards = (scenarioData.hazards || []).map((hazard: any) => {
          const baseHazard: SimulationHazard = {
            position: [...hazard.position, 0], // Add z coordinate
            type: hazard.type || "fire",
            radius: hazard.radius || 2.0,
            intensity: hazard.intensity || 1.0,
          };

          // Add environment-specific properties if they exist
          if (hazard.dimensions) baseHazard.dimensions = hazard.dimensions;
          if (hazard.is_transparent !== undefined)
            baseHazard.is_transparent = hazard.is_transparent;
          if (hazard.is_open !== undefined) baseHazard.is_open = hazard.is_open;
          if (hazard.texture) baseHazard.texture = hazard.texture;
          if (hazard.height) baseHazard.height = hazard.height;

          return baseHazard;
        });

        // Create agent data for each time step
        const numAgents = positionHistory[0].length;
        const agentsByTimeStep = Array(timeSteps)
          .fill(null)
          .map((_, t) => {
            return Array(numAgents)
              .fill(null)
              .map((_, i) => ({
                position: [...positionHistory[t][i], 0], // Add z coordinate
                velocity: [...velocityHistory[t][i], 0],
                status: 0, // Active by default
              }));
          });

        setMicroscopicData({
          timeSteps: agentsByTimeStep.map((agents, t) => ({
            agents,
            walls,
            exits,
            hazards,
            timeStep: t,
            totalTimeSteps: timeSteps,
          })),
          currentStep: 0,
        });
      } else if (simulationType === "mesoscopic") {
        setMesoscopicData({
          density: simulationResponse.data.results.density,
          velocity_x: simulationResponse.data.results.velocity_x,
          velocity_y: simulationResponse.data.results.velocity_y,
          total_occupancy: simulationResponse.data.results.total_occupancy,
          grid_size: simulationResponse.data.results.grid_size,
          time_steps: simulationResponse.data.results.time_steps,
          exits: scenarioData.building_layout.exits,
          walls: scenarioData.building_layout.walls,
        });
      } else {
        setMacroscopicData({
          density: simulationResponse.data.results.density,
          velocity_x: simulationResponse.data.results.velocity_x,
          velocity_y: simulationResponse.data.results.velocity_y,
          fire: simulationResponse.data.results.fire,
          evacuated_count: simulationResponse.data.results.evacuated_count,
          grid_resolution: simulationResponse.data.results.grid_resolution,
          time_steps: simulationResponse.data.results.time_steps,
          dt: simulationResponse.data.results.dt,
          building_layout: {
            walls: scenarioData.building_layout.walls,
            exits: scenarioData.building_layout.exits,
          },
        });
      }
    } catch (err) {
      console.error(`Error running ${simulationType} simulation:`, err);
      setError(
        `Failed to run simulation: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleMicroscopicTimeStepChange = (timeStep: number) => {
    if (microscopicData) {
      setMicroscopicData({
        ...microscopicData,
        currentStep: timeStep,
      });
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Multi-Scale Evacuation Simulation
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel id="scenario-select-label">Scenario</InputLabel>
            <Select
              labelId="scenario-select-label"
              value={selectedScenario}
              label="Scenario"
              onChange={handleScenarioChange}
              disabled={loading}
            >
              {scenarios.map((scenario) => (
                <MenuItem key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel id="preset-select-label">Parameter Preset</InputLabel>
            <Select
              labelId="preset-select-label"
              value={selectedPreset}
              label="Parameter Preset"
              onChange={(e) => setSelectedPreset(e.target.value)}
              disabled={loading || parameterPresets.length === 0}
            >
              {parameterPresets.map((preset) => (
                <MenuItem key={preset} value={preset}>
                  {preset.charAt(0).toUpperCase() + preset.slice(1)} Parameters
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={4}>
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={runSimulation}
            disabled={loading || !selectedScenario}
          >
            {loading ? <CircularProgress size={24} /> : "Run Simulation"}
          </Button>
        </Grid>
      </Grid>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Microscopic" />
          <Tab label="Mesoscopic" />
          <Tab label="Macroscopic" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Box sx={{ height: 700 }}>
          <MicroscopicView
            simulationData={
              microscopicData?.timeSteps?.[microscopicData.currentStep]
            }
            onTimeStepChange={handleMicroscopicTimeStepChange}
          />
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Box sx={{ height: 700 }}>
          <MesoscopicView simulationData={mesoscopicData} />
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Box sx={{ height: 700 }}>
          <MacroscopicView simulationData={macroscopicData} />
        </Box>
      </TabPanel>
    </Box>
  );
}
