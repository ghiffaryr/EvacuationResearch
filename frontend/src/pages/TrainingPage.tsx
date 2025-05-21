import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  MenuItem,
  Select,
  Slider,
  Switch,
  Typography,
  Grid,
  Paper,
  Alert,
  SelectChangeEvent,
  InputLabel,
} from "@mui/material";
import Plot from "react-plotly.js";
import {
  fetchScenarios,
  startTrainingScenario,
  ScenarioType,
  TrainingResults,
} from "../api";
import { useStore } from "../store";

const TrainingPage = () => {
  const [scenarios, setScenarios] = useState<ScenarioType[]>([]);
  const [selectedScenario, setSelectedScenario] = useState("");
  const [modelType, setModelType] = useState("rl");
  const [gridSize, setGridSize] = useState(20);
  const [numAgents, setNumAgents] = useState(10);
  const [episodes, setEpisodes] = useState(10);
  const [useFairness, setUseFairness] = useState(false);
  const [useGPU, setUseGPU] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [trainingResults, setTrainingResults] =
    useState<TrainingResults | null>(null);

  // Use global state to track training - fix: only destructure what we use
  const { setTrainingStatus } = useStore();

  useEffect(() => {
    const fetchScenarioData = async () => {
      try {
        setLoading(true);
        const data = await fetchScenarios();
        setScenarios(data);
        if (data.length > 0) {
          setSelectedScenario(data[0].id);
        }
      } catch (err) {
        setError("Failed to fetch scenarios");
        console.error("Failed to fetch scenarios:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchScenarioData();
  }, []);

  const handleModelTypeChange = (event: SelectChangeEvent) => {
    setModelType(event.target.value);
  };

  const handleGridSizeChange = (_: Event, newValue: number | number[]) => {
    setGridSize(newValue as number);
  };

  const handleNumAgentsChange = (_: Event, newValue: number | number[]) => {
    setNumAgents(newValue as number);
  };

  const handleEpisodesChange = (_: Event, newValue: number | number[]) => {
    setEpisodes(newValue as number);
  };

  const startTraining = async () => {
    if (!selectedScenario) {
      setError("Please select a scenario first");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    setTrainingStatus({
      isTraining: true,
      progress: 0,
      modelId: null,
      error: null,
    });

    try {
      console.log("Starting training with scenario:", selectedScenario);
      console.log("Training parameters:", {
        modelType,
        gridSize,
        numAgents,
        episodes,
        useFairness,
        useGPU,
      });

      const result = await startTrainingScenario(selectedScenario, {
        modelType,
        gridSize,
        numAgents,
        episodes,
        useFairness,
        useGPU,
      });

      setTrainingResults(result);
      setSuccess("Training completed successfully");
      setTrainingStatus({
        isTraining: false,
        progress: 100,
        modelId: `${modelType}_${gridSize}x${gridSize}_model`,
        error: null,
      });
    } catch (err) {
      console.error("Training failed:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(`Failed to start training: ${errorMessage}`);
      setTrainingStatus({
        isTraining: false,
        progress: 0,
        modelId: null,
        error: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Training Settings
            </Typography>

            <FormControl fullWidth variant="outlined" sx={{ mt: 2 }}>
              <InputLabel>Scenario</InputLabel>
              <Select
                value={selectedScenario}
                onChange={(e) => setSelectedScenario(e.target.value)}
                disabled={loading}
                label="Scenario"
              >
                {scenarios.map((scenario) => (
                  <MenuItem key={scenario.id} value={scenario.id}>
                    {scenario.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth variant="outlined" sx={{ mt: 2 }}>
              <InputLabel>Model Type</InputLabel>
              <Select
                value={modelType}
                onChange={handleModelTypeChange}
                disabled={loading}
                label="Model Type"
              >
                <MenuItem value="rl">Reinforcement Learning</MenuItem>
              </Select>
            </FormControl>

            <Typography id="grid-size-slider" gutterBottom sx={{ mt: 2 }}>
              Grid Size: {gridSize}
            </Typography>
            <Slider
              value={gridSize}
              onChange={handleGridSizeChange}
              min={20}
              max={100}
              step={10}
              disabled={loading}
              aria-labelledby="grid-size-slider"
            />

            <Typography id="num-agents-slider" gutterBottom sx={{ mt: 2 }}>
              Number of Agents: {numAgents}
            </Typography>
            <Slider
              value={numAgents}
              onChange={handleNumAgentsChange}
              min={10}
              max={500}
              step={10}
              disabled={loading}
              aria-labelledby="num-agents-slider"
            />

            <Typography id="episodes-slider" gutterBottom sx={{ mt: 2 }}>
              Training Episodes: {episodes}
            </Typography>
            <Slider
              value={episodes}
              onChange={handleEpisodesChange}
              min={10}
              max={1000}
              step={10}
              disabled={loading}
              aria-labelledby="episodes-slider"
            />

            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={useFairness}
                    onChange={(e) => setUseFairness(e.target.checked)}
                    disabled={loading}
                  />
                }
                label="Use Fairness Reward"
              />
            </Box>

            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={useGPU}
                    onChange={(e) => setUseGPU(e.target.checked)}
                    disabled={loading}
                  />
                }
                label="Use GPU Acceleration"
              />
            </Box>

            <Button
              variant="contained"
              color="primary"
              fullWidth
              onClick={startTraining}
              disabled={loading || !selectedScenario}
              sx={{ mt: 3 }}
            >
              {loading ? <CircularProgress size={24} /> : "Start Training"}
            </Button>

            {error && (
              <Alert severity="error" sx={{ mt: 3 }}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ mt: 3 }}>
                {success}
              </Alert>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          {trainingResults ? (
            <Box>
              <Typography variant="h6" gutterBottom>
                Training Results
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Card>
                    <CardHeader title="Reward Over Time" />
                    <Divider />
                    <CardContent>
                      <Plot
                        data={[
                          {
                            x: Array.from(
                              { length: trainingResults.rewards.length },
                              (_, i) => i + 1
                            ),
                            y: trainingResults.rewards,
                            type: "scatter",
                            mode: "lines",
                            marker: { color: "blue" },
                            name: "Reward",
                          },
                        ]}
                        layout={{
                          autosize: true,
                          height: 300,
                          margin: { l: 50, r: 30, b: 30, t: 30 },
                          xaxis: { title: { text: "Episode" } },
                          yaxis: { title: { text: "Reward" } },
                        }}
                        style={{ width: "100%", height: "100%" }}
                        useResizeHandler={true}
                      />
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card>
                    <CardHeader title="Evacuation Time" />
                    <Divider />
                    <CardContent>
                      <Plot
                        data={[
                          {
                            x: Array.from(
                              {
                                length: trainingResults.evacuation_times.length,
                              },
                              (_, i) => i + 1
                            ),
                            y: trainingResults.evacuation_times,
                            type: "scatter",
                            mode: "lines",
                            marker: { color: "green" },
                            name: "Evacuation Time",
                          },
                        ]}
                        layout={{
                          autosize: true,
                          height: 300,
                          margin: { l: 50, r: 30, b: 30, t: 30 },
                          xaxis: { title: { text: "Episode" } },
                          yaxis: { title: { text: "Time Steps" } },
                        }}
                        style={{ width: "100%", height: "100%" }}
                        useResizeHandler={true}
                      />
                    </CardContent>
                  </Card>
                </Grid>

                {trainingResults.gini_history &&
                  trainingResults.gini_history.length > 0 && (
                    <Grid item xs={12} md={6}>
                      <Card>
                        <CardHeader title="Exit Allocation Fairness" />
                        <Divider />
                        <CardContent>
                          <Plot
                            data={[
                              {
                                x: Array.from(
                                  {
                                    length: trainingResults.gini_history.length,
                                  },
                                  (_, i) => i + 1
                                ),
                                y: trainingResults.gini_history.map(
                                  (g: number) => 1 - g
                                ), // Convert Gini to fairness
                                type: "scatter",
                                mode: "lines",
                                marker: { color: "orange" },
                                name: "Fairness (1 - Gini)",
                              },
                            ]}
                            layout={{
                              autosize: true,
                              height: 300,
                              margin: { l: 50, r: 30, b: 30, t: 30 },
                              xaxis: { title: { text: "Episode" } },
                              yaxis: {
                                title: { text: "Fairness Score" },
                                range: [0, 1],
                              },
                            }}
                            style={{ width: "100%", height: "100%" }}
                            useResizeHandler={true}
                          />
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
              </Grid>
            </Box>
          ) : (
            <Paper
              elevation={3}
              sx={{
                p: 3,
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Typography variant="body1" color="text.secondary">
                Start training to see results and metrics
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default TrainingPage;
