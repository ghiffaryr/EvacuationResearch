import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Grid,
  Paper,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardActions,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  ArrowBack as BackIcon,
} from "@mui/icons-material";
import axios from "axios";

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
      id={`scenario-tabpanel-${index}`}
      aria-labelledby={`scenario-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

type Wall = [[number, number], [number, number]];
type Exit = [number, number];
type InitialPosition = { x: number; y: number; count: number };
type Hazard = {
  position: [number, number];
  type: string;
  radius: number;
  intensity: number;
};

export default function ScenarioEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tabValue, setTabValue] = useState(0);

  // Scenario data
  const [scenarioName, setScenarioName] = useState("");
  const [scenarioDescription, setScenarioDescription] = useState("");
  const [scenarioType, setScenarioType] = useState("building");
  const [walls, setWalls] = useState<Wall[]>([]);
  const [exits, setExits] = useState<Exit[]>([]);
  const [initialPositions, setInitialPositions] = useState<InitialPosition[]>(
    []
  );
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [numAgents, setNumAgents] = useState(100);
  const [panicFactor, setPanicFactor] = useState(1.2);
  const [timeSteps, setTimeSteps] = useState(100);

  // Form editing state
  const [newWall, setNewWall] = useState<{
    start: [number, number];
    end: [number, number];
  }>({
    start: [0, 0],
    end: [0, 0],
  });
  const [newExit, setNewExit] = useState<Exit>([0, 0]);
  const [newPosition, setNewPosition] = useState<InitialPosition>({
    x: 0,
    y: 0,
    count: 10,
  });
  const [newHazard, setNewHazard] = useState<Hazard>({
    position: [0, 0],
    type: "fire",
    radius: 2.0,
    intensity: 1.0,
  });

  // Dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  // Add state for scenario list
  const [relatedScenarios, setRelatedScenarios] = useState<
    Array<{ id: string; name: string; type: string }>
  >([]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Load all scenarios to show in the list
  useEffect(() => {
    fetchScenarios();
  }, []);

  // Load scenario if editing
  useEffect(() => {
    if (id) {
      loadScenario(id);
    }
  }, [id]);

  // Add function to fetch all scenarios
  const fetchScenarios = async () => {
    try {
      const response = await axios.get("/api/scenarios");
      if (response.data && response.data.scenarios) {
        setRelatedScenarios(
          response.data.scenarios.map((s: any) => ({
            id: s.id,
            name: s.name,
            type: s.type,
          }))
        );
      }
    } catch (err) {
      console.error("Error fetching scenarios list:", err);
    }
  };

  const loadScenario = async (scenarioId: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await axios.get(`/api/scenarios/${scenarioId}`);
      const scenario = response.data;

      // Set basic info
      setScenarioName(scenario.name || "");
      setScenarioDescription(scenario.description || "");
      setScenarioType(scenario.type || "building");
      setNumAgents(scenario.num_agents || 100);
      setPanicFactor(scenario.panic_factor || 1.2);
      setTimeSteps(scenario.time_steps || 100);

      // Set building layout
      if (scenario.building_layout) {
        setWalls(scenario.building_layout.walls || []);
        setExits(scenario.building_layout.exits || []);
        setInitialPositions(scenario.building_layout.initial_positions || []);
      }

      // Set hazards
      setHazards(scenario.hazards || []);
    } catch (err) {
      console.error("Error loading scenario:", err);
      setError("Failed to load scenario");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate required fields
    if (!scenarioName) {
      setError("Scenario name is required");
      return;
    }

    // Validate at least one exit
    if (exits.length === 0) {
      setError("At least one exit is required");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    // Prepare scenario data
    const scenarioData = {
      id: id || undefined, // Only include if editing
      name: scenarioName,
      description: scenarioDescription,
      type: scenarioType,
      num_agents: numAgents,
      panic_factor: panicFactor,
      time_steps: timeSteps,
      building_layout: {
        walls,
        exits,
        initial_positions: initialPositions,
      },
      hazards,
    };

    try {
      if (id) {
        // Update existing
        await axios.put(`/api/scenarios/${id}`, scenarioData);
        setSuccess("Scenario updated successfully");
      } else {
        // Create new
        const response = await axios.post("/api/scenarios", scenarioData);
        setSuccess("Scenario created successfully");

        // Navigate to the edit page for the new scenario
        navigate(`/scenarios/${response.data.scenario_id}`);
      }
    } catch (err) {
      console.error("Error saving scenario:", err);
      setError(
        `Failed to save scenario: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    setSaving(true);
    setError("");

    try {
      await axios.delete(`/api/scenarios/${id}`);
      setSuccess("Scenario deleted successfully");

      // Navigate back to scenario list
      setTimeout(() => navigate("/scenarios"), 1000);
    } catch (err) {
      console.error("Error deleting scenario:", err);
      setError(
        `Failed to delete scenario: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setSaving(false);
      setDeleteConfirmOpen(false);
    }
  };

  const addWall = () => {
    setWalls([...walls, [newWall.start, newWall.end]]);
    setNewWall({ start: [0, 0], end: [0, 0] });
  };

  const deleteWall = (index: number) => {
    setWalls(walls.filter((_, i) => i !== index));
  };

  const addExit = () => {
    setExits([...exits, newExit]);
    setNewExit([0, 0]);
  };

  const deleteExit = (index: number) => {
    setExits(exits.filter((_, i) => i !== index));
  };

  const addInitialPosition = () => {
    setInitialPositions([...initialPositions, newPosition]);
    setNewPosition({ x: 0, y: 0, count: 10 });
  };

  const deleteInitialPosition = (index: number) => {
    setInitialPositions(initialPositions.filter((_, i) => i !== index));
  };

  const addHazard = () => {
    setHazards([...hazards, newHazard]);
    setNewHazard({
      position: [0, 0],
      type: "fire",
      radius: 2.0,
      intensity: 1.0,
    });
  };

  const deleteHazard = (index: number) => {
    setHazards(hazards.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="50vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={3}>
        {id == "Edit Scenario" && (
          <IconButton onClick={() => navigate("/scenarios")} sx={{ mr: 2 }}>
            <BackIcon />
          </IconButton>
        )}
        <Typography variant="h4">
          {id ? "Edit Scenario" : "Create New Scenario"}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Basic Information
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              label="Scenario Name"
              fullWidth
              required
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Scenario Type</InputLabel>
              <Select
                value={scenarioType}
                label="Scenario Type"
                onChange={(e) => setScenarioType(e.target.value)}
              >
                <MenuItem value="building">Building</MenuItem>
                <MenuItem value="stadium">Stadium</MenuItem>
                <MenuItem value="mall">Shopping Mall</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={scenarioDescription}
              onChange={(e) => setScenarioDescription(e.target.value)}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              label="Number of Agents"
              type="number"
              fullWidth
              value={numAgents}
              onChange={(e) => setNumAgents(parseInt(e.target.value) || 100)}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              label="Panic Factor"
              type="number"
              fullWidth
              value={panicFactor}
              onChange={(e) =>
                setPanicFactor(parseFloat(e.target.value) || 1.2)
              }
              inputProps={{ step: "0.1" }}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              label="Time Steps"
              type="number"
              fullWidth
              value={timeSteps}
              onChange={(e) => setTimeSteps(parseInt(e.target.value) || 100)}
            />
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={3} sx={{ p: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 2 }}>
          <Tab label="Walls" />
          <Tab label="Exits" />
          <Tab label="Initial Positions" />
          <Tab label="Hazards" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                Add New Wall
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="Start X"
                    type="number"
                    fullWidth
                    value={newWall.start[0]}
                    onChange={(e) =>
                      setNewWall({
                        ...newWall,
                        start: [
                          parseFloat(e.target.value) || 0,
                          newWall.start[1],
                        ],
                      })
                    }
                    inputProps={{ step: "0.5" }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Start Y"
                    type="number"
                    fullWidth
                    value={newWall.start[1]}
                    onChange={(e) =>
                      setNewWall({
                        ...newWall,
                        start: [
                          newWall.start[0],
                          parseFloat(e.target.value) || 0,
                        ],
                      })
                    }
                    inputProps={{ step: "0.5" }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="End X"
                    type="number"
                    fullWidth
                    value={newWall.end[0]}
                    onChange={(e) =>
                      setNewWall({
                        ...newWall,
                        end: [parseFloat(e.target.value) || 0, newWall.end[1]],
                      })
                    }
                    inputProps={{ step: "0.5" }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="End Y"
                    type="number"
                    fullWidth
                    value={newWall.end[1]}
                    onChange={(e) =>
                      setNewWall({
                        ...newWall,
                        end: [newWall.end[0], parseFloat(e.target.value) || 0],
                      })
                    }
                    inputProps={{ step: "0.5" }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={addWall}
                    fullWidth
                  >
                    Add Wall
                  </Button>
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                Wall List
              </Typography>
              <List dense>
                {walls.map((wall, index) => (
                  <ListItem
                    key={index}
                    secondaryAction={
                      <IconButton edge="end" onClick={() => deleteWall(index)}>
                        <DeleteIcon />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={`Wall ${index + 1}`}
                      secondary={`From (${wall[0][0]}, ${wall[0][1]}) to (${wall[1][0]}, ${wall[1][1]})`}
                    />
                  </ListItem>
                ))}
                {walls.length === 0 && (
                  <ListItem>
                    <ListItemText primary="No walls defined" />
                  </ListItem>
                )}
              </List>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                Add New Exit
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="Exit X"
                    type="number"
                    fullWidth
                    value={newExit[0]}
                    onChange={(e) =>
                      setNewExit([parseFloat(e.target.value) || 0, newExit[1]])
                    }
                    inputProps={{ step: "0.5" }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Exit Y"
                    type="number"
                    fullWidth
                    value={newExit[1]}
                    onChange={(e) =>
                      setNewExit([newExit[0], parseFloat(e.target.value) || 0])
                    }
                    inputProps={{ step: "0.5" }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={addExit}
                    fullWidth
                  >
                    Add Exit
                  </Button>
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                Exit List
              </Typography>
              <List dense>
                {exits.map((exit, index) => (
                  <ListItem
                    key={index}
                    secondaryAction={
                      <IconButton edge="end" onClick={() => deleteExit(index)}>
                        <DeleteIcon />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={`Exit ${index + 1}`}
                      secondary={`Position: (${exit[0]}, ${exit[1]})`}
                    />
                  </ListItem>
                ))}
                {exits.length === 0 && (
                  <ListItem>
                    <ListItemText primary="No exits defined" />
                  </ListItem>
                )}
              </List>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                Add Initial Position
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="Position X"
                    type="number"
                    fullWidth
                    value={newPosition.x}
                    onChange={(e) =>
                      setNewPosition({
                        ...newPosition,
                        x: parseFloat(e.target.value) || 0,
                      })
                    }
                    inputProps={{ step: "0.5" }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Position Y"
                    type="number"
                    fullWidth
                    value={newPosition.y}
                    onChange={(e) =>
                      setNewPosition({
                        ...newPosition,
                        y: parseFloat(e.target.value) || 0,
                      })
                    }
                    inputProps={{ step: "0.5" }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Agent Count"
                    type="number"
                    fullWidth
                    value={newPosition.count}
                    onChange={(e) =>
                      setNewPosition({
                        ...newPosition,
                        count: parseInt(e.target.value) || 10,
                      })
                    }
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={addInitialPosition}
                    fullWidth
                  >
                    Add Initial Position
                  </Button>
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                Initial Positions
              </Typography>
              <List dense>
                {initialPositions.map((pos, index) => (
                  <ListItem
                    key={index}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        onClick={() => deleteInitialPosition(index)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={`Position ${index + 1}`}
                      secondary={`(${pos.x}, ${pos.y}) - ${pos.count} agents`}
                    />
                  </ListItem>
                ))}
                {initialPositions.length === 0 && (
                  <ListItem>
                    <ListItemText primary="No initial positions defined" />
                  </ListItem>
                )}
              </List>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                Add Hazard
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="Position X"
                    type="number"
                    fullWidth
                    value={newHazard.position[0]}
                    onChange={(e) =>
                      setNewHazard({
                        ...newHazard,
                        position: [
                          parseFloat(e.target.value) || 0,
                          newHazard.position[1],
                        ],
                      })
                    }
                    inputProps={{ step: "0.5" }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Position Y"
                    type="number"
                    fullWidth
                    value={newHazard.position[1]}
                    onChange={(e) =>
                      setNewHazard({
                        ...newHazard,
                        position: [
                          newHazard.position[0],
                          parseFloat(e.target.value) || 0,
                        ],
                      })
                    }
                    inputProps={{ step: "0.5" }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Hazard Type</InputLabel>
                    <Select
                      value={newHazard.type}
                      label="Hazard Type"
                      onChange={(e) =>
                        setNewHazard({
                          ...newHazard,
                          type: e.target.value,
                        })
                      }
                    >
                      <MenuItem value="fire">Fire</MenuItem>
                      <MenuItem value="water">Flood Water</MenuItem>
                      <MenuItem value="structural">Structural Damage</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Radius"
                    type="number"
                    fullWidth
                    value={newHazard.radius}
                    onChange={(e) =>
                      setNewHazard({
                        ...newHazard,
                        radius: parseFloat(e.target.value) || 1.0,
                      })
                    }
                    inputProps={{ step: "0.5" }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Intensity"
                    type="number"
                    fullWidth
                    value={newHazard.intensity}
                    onChange={(e) =>
                      setNewHazard({
                        ...newHazard,
                        intensity: parseFloat(e.target.value) || 1.0,
                      })
                    }
                    inputProps={{ step: "0.1", min: "0", max: "1" }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={addHazard}
                    fullWidth
                  >
                    Add Hazard
                  </Button>
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                Hazard List
              </Typography>
              <List dense>
                {hazards.map((hazard, index) => (
                  <ListItem
                    key={index}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        onClick={() => deleteHazard(index)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={`${
                        hazard.type.charAt(0).toUpperCase() +
                        hazard.type.slice(1)
                      } Hazard`}
                      secondary={`Position: (${hazard.position[0]}, ${hazard.position[1]}), Radius: ${hazard.radius}, Intensity: ${hazard.intensity}`}
                    />
                  </ListItem>
                ))}
                {hazards.length === 0 && (
                  <ListItem>
                    <ListItemText primary="No hazards defined" />
                  </ListItem>
                )}
              </List>
            </Grid>
          </Grid>
        </TabPanel>

        <Box mt={4} display="flex" justifyContent="space-between">
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <CircularProgress size={24} /> : "Save Scenario"}
          </Button>

          {id && (
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={saving}
            >
              Delete Scenario
            </Button>
          )}
        </Box>
      </Paper>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Delete Scenario</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this scenario? This action cannot be
            undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Scenario List */}
      <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Related Scenarios
        </Typography>

        {relatedScenarios.length === 0 ? (
          <Typography color="text.secondary">
            No other scenarios available
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {relatedScenarios
              .filter((s) => s.id !== id) // Don't show current scenario
              .map((scenario) => (
                <Grid item xs={12} sm={6} md={4} key={scenario.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1">
                        {scenario.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Type: {scenario.type}
                      </Typography>
                    </CardContent>
                    <CardActions>
                      <Button
                        size="small"
                        onClick={() => navigate(`/scenarios/${scenario.id}`)}
                      >
                        View
                      </Button>
                      <Button
                        size="small"
                        onClick={() => {
                          if (scenario.id !== id) {
                            loadScenario(scenario.id);
                            navigate(`/scenarios/${scenario.id}`);
                          }
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Do you want to use this as a template for a new scenario?"
                            )
                          ) {
                            loadScenario(scenario.id);
                            // Clear the ID to create a new scenario
                            navigate("/scenarios/new");
                            setScenarioName(`Copy of ${scenario.name}`);
                          }
                        }}
                      >
                        Use as Template
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
          </Grid>
        )}
      </Paper>
    </Box>
  );
}
