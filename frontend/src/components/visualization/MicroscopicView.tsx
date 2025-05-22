import { useRef, useEffect, useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  FlyControls,
  FirstPersonControls,
  PointerLockControls,
} from "@react-three/drei";
import {
  Box,
  Slider,
  Typography,
  Paper,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  IconButton,
  Collapse,
  Card,
  CardContent,
} from "@mui/material";
import {
  PlayArrow,
  Pause,
  Fullscreen,
  FullscreenExit,
  ExpandMore,
  ExpandLess,
  Settings,
} from "@mui/icons-material";
import * as THREE from "three";

interface Agent {
  position: [number, number, number];
  status: number; // 0 = active, 1 = evacuated
  velocity: [number, number, number];
}

interface Wall {
  start: [number, number, number];
  end: [number, number, number];
}

interface Exit {
  position: [number, number, number];
  size: number;
}

interface Hazard {
  position: [number, number, number];
  type: string;
  radius: number;
  intensity: number;
  spread_rate?: number;
  duration?: number;
  aftershocks?: boolean;
  rise_rate?: number;
  flow_direction?: [number, number];
  cause?: string;
  is_debris?: boolean;
  dimensions?: [number, number];
  is_transparent?: boolean;
  is_open?: boolean;
  texture?: string;
  height?: number;
}

interface MicroscopicViewProps {
  simulationData?: {
    agents: Agent[];
    walls: Wall[];
    exits: Exit[];
    hazards: Hazard[];
    timeStep: number;
    totalTimeSteps: number;
  };
  onTimeStepChange?: (timeStep: number) => void;
}

function Walls({ walls }: { walls: Wall[] }) {
  return (
    <>
      {walls.map((wall, idx) => {
        const { start, end } = wall;
        const direction = new THREE.Vector3(
          end[0] - start[0],
          end[1] - start[1],
          end[2] - start[2]
        );
        const length = direction.length();
        direction.normalize();

        // Calculate rotation to align with direction
        const quaternion = new THREE.Quaternion();
        const startVec = new THREE.Vector3(start[0], start[1], start[2]);
        const endVec = new THREE.Vector3(end[0], end[1], end[2]);

        // Default up vector - unused but kept for clarity
        // const up = new THREE.Vector3(0, 1, 0)

        // Find midpoint for wall position
        const midpoint = startVec.clone().add(endVec).multiplyScalar(0.5);

        // Calculate orientation
        if (Math.abs(direction.y) < 0.99) {
          const axis = new THREE.Vector3(0, 0, 1).cross(direction);
          const angle = Math.acos(new THREE.Vector3(0, 0, 1).dot(direction));
          quaternion.setFromAxisAngle(axis, angle);
        }

        return (
          <mesh
            key={idx}
            position={[midpoint.x, midpoint.y, midpoint.z]}
            quaternion={quaternion}
          >
            <boxGeometry args={[length, 2, 0.2]} />
            <meshStandardMaterial color="#222222" roughness={0.8} />{" "}
            {/* Darker walls for better visibility */}
          </mesh>
        );
      })}
    </>
  );
}

function Exits({ exits }: { exits: Exit[] }) {
  return (
    <>
      {exits.map((exit, idx) => (
        <mesh key={idx} position={exit.position}>
          <boxGeometry args={[exit.size, exit.size, 0.1]} />
          <meshStandardMaterial
            color="#00aa00"
            emissive="#00ff00"
            emissiveIntensity={0.5}
            transparent
            opacity={0.8}
          />{" "}
          {/* Brighter green for exits */}
        </mesh>
      ))}
    </>
  );
}

function Hazards({ hazards }: { hazards: Hazard[] }) {
  return (
    <>
      {hazards.map((hazard, idx) => {
        let color = "#ff3300"; // Default fire color
        let emissive = "#ff6600"; // Add glow to fire
        let opacity = Math.min(0.9, hazard.intensity * 0.9);

        if (hazard.type === "earthquake") {
          color = "#8800bb"; // Purple for earthquake
          emissive = "#aa66cc";
        } else if (hazard.type === "flood" || hazard.type === "water") {
          color = "#0099ff"; // Blue for flood
          emissive = "#0099ff";
          opacity = Math.min(0.7, hazard.intensity * 0.7); // More transparent
        } else if (hazard.type === "structural") {
          color = "#aa6600"; // Brown for structural damage
          emissive = "#cc8800";
        }

        // Choose the appropriate geometry based on hazard type
        const renderGeometry = () => {
          if (hazard.type === "earthquake") {
            return (
              <cylinderGeometry
                args={[hazard.radius, hazard.radius, 0.5, 32]}
              />
            );
          } else if (hazard.type === "flood" || hazard.type === "water") {
            return (
              <cylinderGeometry
                args={[hazard.radius, hazard.radius, 0.3, 32]}
              />
            );
          } else if (hazard.type === "structural") {
            return (
              <boxGeometry
                args={[hazard.radius * 1.5, 1.0, hazard.radius * 1.5]}
              />
            );
          } else {
            // Default for fire
            return <sphereGeometry args={[hazard.radius, 32, 32]} />;
          }
        };

        return (
          <mesh key={idx} position={hazard.position}>
            {renderGeometry()}
            <meshStandardMaterial
              color={color}
              emissive={emissive}
              emissiveIntensity={0.6}
              transparent
              opacity={opacity}
            />
          </mesh>
        );
      })}
    </>
  );
}

function Agents({ agents }: { agents: Agent[] }) {
  return (
    <>
      {agents.map((agent, idx) => {
        const isActive = agent.status === 0;
        // More distinct colors with better contrast
        const color = isActive ? "#0077ff" : "#00cc44";
        const emissive = isActive ? "#0066cc" : "#009933";

        // Skip rendering agents that have been evacuated
        if (!isActive && agent.position[0] < -100) return null;

        return (
          <mesh key={idx} position={agent.position}>
            <cylinderGeometry args={[0.25, 0.25, 0.7, 16]} />
            <meshStandardMaterial
              color={color}
              emissive={emissive}
              emissiveIntensity={0.3}
              metalness={0.2}
              roughness={0.7}
            />

            {/* Add velocity vector indicator for active agents with improved visibility */}
            {isActive && agent.velocity && (
              <arrowHelper
                args={[
                  new THREE.Vector3(
                    agent.velocity[0],
                    agent.velocity[1],
                    agent.velocity[2]
                  ).normalize(),
                  new THREE.Vector3(0, 0, 0),
                  0.7, // Longer arrow
                  0xffcc00, // Brighter yellow color
                  0.2, // Head length
                  0.1, // Head width
                ]}
              />
            )}
          </mesh>
        );
      })}
    </>
  );
}

// Add new component for environmental elements
function EnvironmentElements({ hazards }: { hazards: Hazard[] }) {
  return (
    <>
      {hazards
        .filter((hazard) =>
          [
            "window",
            "door",
            "floor",
            "ceiling",
            "soil",
            "grass",
            "chair",
            "table",
          ].includes(hazard.type)
        )
        .map((hazard, idx) => {
          const [x, y, z] = hazard.position;
          const dimensions = hazard.dimensions || [1, 1];
          const width = dimensions[0];
          const length = dimensions[1];

          // Determine material properties based on type
          let color = "#ffffff";
          let opacity = 1.0;
          let emissive = "#000000";
          let emissiveIntensity = 0;
          let metalness = 0.0;
          let roughness = 0.5;

          // Calculate position and rotation based on element type
          let positionY = z;
          let rotationX = 0;
          let rotationY = 0;
          let rotationZ = 0;

          if (hazard.type === "window") {
            color = hazard.is_transparent ? "#a6d8ff" : "#d4f1f9";
            opacity = hazard.is_transparent ? 0.3 : 0.8;
            positionY = 1.5; // Position at standard window height
            roughness = 0.2; // Smooth like glass
          } else if (hazard.type === "door") {
            color = "#8B4513"; // Brown for wooden door
            positionY = 1.0; // Door height
            // If door is open, rotate it
            if (hazard.is_open) {
              rotationY = Math.PI / 2; // 90 degree rotation
            }
          } else if (hazard.type === "floor") {
            positionY = -0.05; // Just below ground level
            rotationX = -Math.PI / 2; // Flat on ground

            // Set floor texture color
            if (hazard.texture === "wood") {
              color = "#D2B48C";
              roughness = 0.7;
            } else if (hazard.texture === "concrete") {
              color = "#C0C0C0";
              roughness = 0.9;
            } else if (hazard.texture === "carpet") {
              color = "#607D8B";
              roughness = 1.0;
            } else {
              // tiles
              color = "#E0E0E0";
              roughness = 0.4;
            }
          } else if (hazard.type === "ceiling") {
            positionY = hazard.height || 3.0; // At ceiling height
            rotationX = Math.PI / 2; // Flat on ceiling

            if (hazard.texture === "exposed") {
              color = "#696969";
              roughness = 0.8;
            } else if (hazard.texture === "tiles") {
              color = "#F5F5F5";
              roughness = 0.5;
            } else {
              // plaster
              color = "#FFFFFF";
              roughness = 0.3;
            }
          } else if (hazard.type === "soil") {
            positionY = -0.1; // Below ground level
            rotationX = -Math.PI / 2; // Flat on ground

            if (hazard.texture === "clay") {
              color = "#A52A2A";
              roughness = 0.9;
            } else if (hazard.texture === "sand") {
              color = "#F4A460";
              roughness = 1.0;
            } else {
              // dirt
              color = "#8B4513";
              roughness = 0.95;
            }
          } else if (hazard.type === "grass") {
            positionY = 0.1; // Just above ground level
            rotationX = -Math.PI / 2; // Flat on ground

            if (hazard.texture === "tall_grass") {
              color = "#228B22";
              roughness = 1.0;
            } else if (hazard.texture === "moss") {
              color = "#2E8B57";
              roughness = 0.9;
            } else {
              // regular grass
              color = "#7CFC00";
              roughness = 0.85;
            }
          } else if (hazard.type === "chair") {
            positionY = hazard.radius / 2; // Half the height

            // Set chair material/color based on texture
            if (hazard.texture === "metal") {
              color = "#A9A9A9";
              metalness = 0.7;
              roughness = 0.3;
            } else if (hazard.texture === "plastic") {
              color = "#1E90FF";
              metalness = 0.1;
              roughness = 0.9;
            } else if (hazard.texture === "fabric") {
              color = "#6495ED";
              metalness = 0.0;
              roughness = 1.0;
            } else {
              // wood
              color = "#8B4513";
              metalness = 0.1;
              roughness = 0.8;
            }
          } else if (hazard.type === "table") {
            positionY = hazard.radius / 2; // Half the height

            // Set table material/color based on texture
            if (hazard.texture === "metal") {
              color = "#A9A9A9";
              metalness = 0.7;
              roughness = 0.3;
            } else if (hazard.texture === "plastic") {
              color = "#E0E0E0";
              metalness = 0.1;
              roughness = 0.9;
            } else if (hazard.texture === "fabric") {
              color = "#DEB887";
              metalness = 0.0;
              roughness = 1.0;
            } else {
              // wood
              color = "#CD853F";
              metalness = 0.1;
              roughness = 0.8;
            }
          }

          return (
            <mesh
              key={`env-${idx}`}
              position={[x, positionY, y]}
              rotation={new THREE.Euler(rotationX, rotationY, rotationZ)}
            >
              {["window", "door", "chair", "table"].includes(hazard.type) ? (
                hazard.type === "chair" ? (
                  // Chair geometry is a combination of box and legs
                  <group>
                    {/* Chair seat */}
                    <mesh position={[0, 0.1, 0]}>
                      <boxGeometry args={[width, 0.1, length]} />
                      <meshStandardMaterial
                        color={color}
                        metalness={metalness}
                        roughness={roughness}
                      />
                    </mesh>

                    {/* Chair back */}
                    <mesh
                      position={[0, hazard.radius * 0.5, -length / 2 + 0.05]}
                    >
                      <boxGeometry args={[width, hazard.radius, 0.1]} />
                      <meshStandardMaterial
                        color={color}
                        metalness={metalness}
                        roughness={roughness}
                      />
                    </mesh>

                    {/* Chair legs */}
                    {[
                      [
                        width / 2 - 0.05,
                        -hazard.radius * 0.3,
                        length / 2 - 0.05,
                      ] as [number, number, number],
                      [
                        width / 2 - 0.05,
                        -hazard.radius * 0.3,
                        -length / 2 + 0.05,
                      ] as [number, number, number],
                      [
                        -width / 2 + 0.05,
                        -hazard.radius * 0.3,
                        length / 2 - 0.05,
                      ] as [number, number, number],
                      [
                        -width / 2 + 0.05,
                        -hazard.radius * 0.3,
                        -length / 2 + 0.05,
                      ] as [number, number, number],
                    ].map((pos, legIdx) => (
                      <mesh key={`leg-${legIdx}`} position={pos}>
                        <cylinderGeometry
                          args={[0.05, 0.05, hazard.radius * 0.6, 8]}
                        />
                        <meshStandardMaterial
                          color={color}
                          metalness={metalness}
                          roughness={roughness}
                        />
                      </mesh>
                    ))}
                  </group>
                ) : hazard.type === "table" ? (
                  // Table geometry is a combination of tabletop and legs
                  <group>
                    {/* Table top */}
                    <mesh position={[0, hazard.radius * 0.9, 0]}>
                      <boxGeometry args={[width, 0.1, length]} />
                      <meshStandardMaterial
                        color={color}
                        metalness={metalness}
                        roughness={roughness}
                      />
                    </mesh>

                    {/* Table legs */}
                    {[
                      [width / 2 - 0.1, 0, length / 2 - 0.1] as [
                        number,
                        number,
                        number
                      ],
                      [width / 2 - 0.1, 0, -length / 2 + 0.1] as [
                        number,
                        number,
                        number
                      ],
                      [-width / 2 + 0.1, 0, length / 2 - 0.1] as [
                        number,
                        number,
                        number
                      ],
                      [-width / 2 + 0.1, 0, -length / 2 + 0.1] as [
                        number,
                        number,
                        number
                      ],
                    ].map((pos, legIdx) => (
                      <mesh key={`leg-${legIdx}`} position={pos}>
                        <cylinderGeometry
                          args={[0.08, 0.08, hazard.radius * 1.8, 8]}
                        />
                        <meshStandardMaterial
                          color={color}
                          metalness={metalness}
                          roughness={roughness}
                        />
                      </mesh>
                    ))}
                  </group>
                ) : (
                  // Regular box geometry for windows and doors
                  <boxGeometry args={[width, length, hazard.radius || 0.05]} />
                )
              ) : (
                // Plane geometry for floor, ceiling, etc.
                <planeGeometry args={[width, length, 10, 10]} />
              )}

              {/* Don't apply standard material to chairs and tables since they have their own */}
              {!["chair", "table"].includes(hazard.type) && (
                <meshStandardMaterial
                  color={color}
                  transparent={opacity < 1.0}
                  opacity={opacity}
                  emissive={emissive}
                  emissiveIntensity={emissiveIntensity}
                  metalness={metalness}
                  roughness={roughness}
                  side={THREE.DoubleSide}
                />
              )}
            </mesh>
          );
        })}
    </>
  );
}

// Update the Scene component to include camera controls based on mode
function Scene({
  simulationData,
  cameraControlMode,
}: {
  simulationData?: MicroscopicViewProps["simulationData"];
  cameraControlMode: string;
}) {
  return (
    <>
      <ambientLight intensity={0.7} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <pointLight position={[-10, 10, -10]} intensity={0.5} color="#f0f0ff" />
      {/* Display simulation elements if data is available */}
      {simulationData && (
        <>
          <Walls walls={simulationData.walls} />
          <Exits exits={simulationData.exits} />
          <EnvironmentElements
            hazards={simulationData.hazards.filter((h) =>
              ["window", "door", "floor", "ceiling", "soil", "grass"].includes(
                h.type
              )
            )}
          />
          <Hazards
            hazards={simulationData.hazards.filter((h) =>
              ["fire", "earthquake", "flood", "structural"].includes(h.type)
            )}
          />
          <Agents agents={simulationData.agents} />

          {/* Ground plane with visible grid */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
            <planeGeometry args={[50, 50]} />
            <meshStandardMaterial color="#f0f0f0" />
          </mesh>

          {/* Add visible grid and axes for better spatial reference */}
          <gridHelper
            args={[50, 50, "#999999", "#dddddd"]}
            position={[0, -0.49, 0]}
          />

          {/* Add coordinate axes */}
          <axesHelper args={[10]} position={[-20, -0.4, -20]} />

          {/* Render appropriate camera controls based on mode */}
          {cameraControlMode === "orbit" && <OrbitControls />}
          {cameraControlMode === "fly" && (
            <FlyControls movementSpeed={10} rollSpeed={0.1} dragToLook={true} />
          )}
          {cameraControlMode === "firstPerson" && (
            <FirstPersonControls
              lookSpeed={0.1}
              movementSpeed={5}
              heightCoef={1}
              lookVertical={true}
            />
          )}
          {cameraControlMode === "pointerLock" && <PointerLockControls />}
        </>
      )}
    </>
  );
}

export default function MicroscopicView({
  simulationData,
  onTimeStepChange,
}: MicroscopicViewProps) {
  const [timeStep, setTimeStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef<number>();
  const lastUpdateTimeRef = useRef<number>(0);
  const totalTimeSteps = simulationData?.totalTimeSteps || 100;
  const [cameraControlMode, setCameraControlMode] = useState<string>("orbit");

  // Add refs and states for new functionality
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [showControls, setShowControls] = useState(true);

  // Handle play/pause toggle
  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Use provided timeStep if it's controlled from parent or handle animation
  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const animate = (time: number) => {
      if (time - lastUpdateTimeRef.current >= 100) {
        // Update every 100ms
        setTimeStep((prev) => {
          const newTimeStep = (prev + 1) % totalTimeSteps;
          if (onTimeStepChange) onTimeStepChange(newTimeStep);
          return newTimeStep;
        });
        lastUpdateTimeRef.current = time;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, totalTimeSteps, onTimeStepChange]);

  const handleTimeStepChange = (_: Event, newValue: number | number[]) => {
    const newTimeStep = newValue as number;
    setTimeStep(newTimeStep);
    if (onTimeStepChange) onTimeStepChange(newTimeStep);
  };

  // Add handler for camera control mode change
  const handleCameraControlChange = (
    _: React.MouseEvent<HTMLElement>,
    newMode: string | null
  ) => {
    if (newMode !== null) {
      setCameraControlMode(newMode);
    }
  };

  // Helper function to get control instructions
  const getCameraControlInstructions = () => {
    switch (cameraControlMode) {
      case "orbit":
        return "Left click & drag to rotate, right click & drag to pan, scroll to zoom";
      case "fly":
        return "WASD to move, R/F to up/down, Q/E to roll, drag mouse to look";
      case "firstPerson":
        return "WASD to move, mouse to look around";
      case "pointerLock":
        return "Click to activate. Mouse to look. ESC to exit";
      default:
        return "";
    }
  };

  // Add fullscreen toggle functionality
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (
        canvasContainerRef.current &&
        canvasContainerRef.current.requestFullscreen
      ) {
        canvasContainerRef.current.requestFullscreen().catch((err) => {
          console.error(
            `Error attempting to enable fullscreen: ${err.message}`
          );
        });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Fix keyboard controls - only intercept SPACE key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only intercept space key, let other keys pass through to FPS controls
      if (e.code === "Space") {
        e.preventDefault(); // Prevent scrolling
        handlePlayPause();
      }
      // Important: We don't handle WASD keys here, so they can be used by the camera controls
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handlePlayPause]);

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 1,
        }}
      >
        <Typography variant="h6">
          Microscopic Simulation
          <Typography
            component="span"
            variant="subtitle2"
            sx={{ ml: 1, color: "text.secondary" }}
          >
            (Agent-Based Model)
          </Typography>
        </Typography>

        <Box>
          <IconButton
            onClick={toggleFullscreen}
            size="small"
            title="Toggle fullscreen"
          >
            {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
          </IconButton>
          <IconButton
            onClick={() => setShowLegend((prev) => !prev)}
            size="small"
            title="Toggle legend"
          >
            {showLegend ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
          <IconButton
            onClick={() => setShowControls((prev) => !prev)}
            size="small"
            title="Toggle controls"
          >
            <Settings />
          </IconButton>
        </Box>
      </Box>

      {/* Fixed layout to ensure proper content separation */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Controls panel */}
        <Collapse in={showControls}>
          <Card variant="outlined" sx={{ backgroundColor: "#f5f5f5" }}>
            <CardContent sx={{ py: 1 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">Camera Mode:</Typography>
                  <ToggleButtonGroup
                    value={cameraControlMode}
                    exclusive
                    onChange={handleCameraControlChange}
                    size="small"
                    aria-label="camera control mode"
                  >
                    <ToggleButton value="orbit">
                      <Tooltip title="Orbit around center point">
                        <span>Orbit</span>
                      </Tooltip>
                    </ToggleButton>
                    <ToggleButton value="fly">
                      <Tooltip title="Free flying camera">
                        <span>Fly</span>
                      </Tooltip>
                    </ToggleButton>
                    <ToggleButton value="firstPerson">
                      <Tooltip title="First person walker">
                        <span>Walk</span>
                      </Tooltip>
                    </ToggleButton>
                    <ToggleButton value="pointerLock">
                      <Tooltip title="FPS-style controls">
                        <span>FPS</span>
                      </Tooltip>
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    {getCameraControlInstructions()}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 0.5 }}
                  >
                    Press <b>Space</b> to play/pause simulation
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Collapse>

        {/* Legend with full visibility without scrolling */}
        <Collapse in={showLegend}>
          <Card variant="outlined" sx={{ backgroundColor: "#f9f9f9" }}>
            <CardContent sx={{ py: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Legend:
              </Typography>
              <Grid container spacing={2}>
                <Grid
                  item
                  xs={6}
                  md={3}
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      backgroundColor: "#0077ff",
                      borderRadius: "50%",
                      mr: 1,
                      boxShadow: "0 0 3px #0077ff",
                    }}
                  />
                  <Typography variant="caption">Active Agent</Typography>
                </Grid>

                <Grid
                  item
                  xs={6}
                  md={3}
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      backgroundColor: "#00cc44",
                      borderRadius: "50%",
                      mr: 1,
                      boxShadow: "0 0 3px #00cc44",
                    }}
                  />
                  <Typography variant="caption">Evacuated Agent</Typography>
                </Grid>

                <Grid
                  item
                  xs={6}
                  md={3}
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      backgroundColor: "#222222",
                      mr: 1,
                    }}
                  />
                  <Typography variant="caption">Wall</Typography>
                </Grid>

                <Grid
                  item
                  xs={6}
                  md={3}
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      backgroundColor: "#00aa00",
                      mr: 1,
                      boxShadow: "0 0 3px #00ff00",
                    }}
                  />
                  <Typography variant="caption">Exit</Typography>
                </Grid>

                <Grid
                  item
                  xs={6}
                  md={3}
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      backgroundColor: "#ff3300",
                      borderRadius: "50%",
                      mr: 1,
                      boxShadow: "0 0 3px #ff6600",
                    }}
                  />
                  <Typography variant="caption">Fire Hazard</Typography>
                </Grid>

                <Grid
                  item
                  xs={6}
                  md={3}
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      backgroundColor: "#0099ff",
                      borderRadius: "50%",
                      mr: 1,
                      boxShadow: "0 0 3px #0099ff",
                    }}
                  />
                  <Typography variant="caption">Flood</Typography>
                </Grid>

                <Grid
                  item
                  xs={6}
                  md={3}
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      backgroundColor: "#8800bb",
                      borderRadius: "50%",
                      mr: 1,
                      boxShadow: "0 0 3px #aa66cc",
                    }}
                  />
                  <Typography variant="caption">Earthquake</Typography>
                </Grid>

                <Grid
                  item
                  xs={6}
                  md={3}
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      backgroundColor: "#aa6600",
                      borderRadius: "50%",
                      mr: 1,
                      boxShadow: "0 0 3px #cc8800",
                    }}
                  />
                  <Typography variant="caption">Structural Damage</Typography>
                </Grid>

                <Grid
                  item
                  xs={6}
                  md={3}
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 16,
                      height: 5,
                      backgroundColor: "#ffcc00",
                      mr: 1,
                      position: "relative",
                      "&::after": {
                        content: '""',
                        position: "absolute",
                        right: -8,
                        top: -3,
                        borderLeft: "8px solid #ffcc00",
                        borderTop: "5px solid transparent",
                        borderBottom: "5px solid transparent",
                      },
                    }}
                  />
                  <Typography variant="caption">Velocity Vector</Typography>
                </Grid>

                <Grid
                  item
                  xs={6}
                  md={3}
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      backgroundColor: "#a6d8ff",
                      mr: 1,
                      opacity: 0.5,
                    }}
                  />
                  <Typography variant="caption">Window</Typography>
                </Grid>

                <Grid
                  item
                  xs={6}
                  md={3}
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      backgroundColor: "#8B4513",
                      mr: 1,
                    }}
                  />
                  <Typography variant="caption">Door</Typography>
                </Grid>

                <Grid
                  item
                  xs={6}
                  md={3}
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      backgroundColor: "#E0E0E0",
                      mr: 1,
                    }}
                  />
                  <Typography variant="caption">Floor</Typography>
                </Grid>

                <Grid
                  item
                  xs={6}
                  md={3}
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      backgroundColor: "#7CFC00",
                      mr: 1,
                    }}
                  />
                  <Typography variant="caption">Grass/Soil</Typography>
                </Grid>

                <Grid
                  item
                  xs={6}
                  md={3}
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      backgroundColor: "#8B4513",
                      mr: 1,
                    }}
                  />
                  <Typography variant="caption">Chair</Typography>
                </Grid>

                <Grid
                  item
                  xs={6}
                  md={3}
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      backgroundColor: "#CD853F",
                      mr: 1,
                    }}
                  />
                  <Typography variant="caption">Table</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Collapse>
      </Box>

      {/* Main 3D view area */}
      <Box
        ref={canvasContainerRef}
        sx={{
          flexGrow: 1,
          height: isFullscreen ? "100vh" : "60vh",
          position: "relative",
          mt: 2,
          mb: 1,
          border: "1px solid #ddd",
          borderRadius: 1,
          overflow: "hidden",
        }}
      >
        <Canvas camera={{ position: [0, 10, 20], fov: 60 }}>
          <Scene
            simulationData={simulationData}
            cameraControlMode={cameraControlMode}
          />
        </Canvas>

        {/* Play/Pause overlay button - only visible in fullscreen mode */}
        {isFullscreen && (
          <Box
            sx={{
              position: "absolute",
              bottom: 16,
              left: 16,
              bgcolor: "rgba(255,255,255,0.7)",
              borderRadius: "50%",
              zIndex: 100,
            }}
          >
            <IconButton
              onClick={handlePlayPause}
              size="large"
              sx={{
                color: isPlaying ? "primary.main" : "action.active",
                "&:hover": { bgcolor: "rgba(255,255,255,0.9)" },
              }}
            >
              {isPlaying ? <Pause /> : <PlayArrow />}
            </IconButton>
          </Box>
        )}
      </Box>

      {/* Timeline controls - always visible */}
      <Grid container spacing={2} alignItems="center" sx={{ mt: 1 }}>
        <Grid item xs={1}>
          <IconButton
            onClick={handlePlayPause}
            color={isPlaying ? "primary" : "default"}
          >
            {isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>
        </Grid>
        <Grid item xs={10}>
          <Slider
            value={timeStep}
            onChange={handleTimeStepChange}
            min={0}
            max={totalTimeSteps - 1}
            step={1}
            valueLabelDisplay="auto"
            valueLabelFormat={(value: number) => `Step ${value}`}
          />
        </Grid>
        <Grid item xs={1}>
          <Typography variant="body2" align="center">
            {timeStep}/{totalTimeSteps - 1}
          </Typography>
        </Grid>
      </Grid>

      {/* Status information */}
      <Box mt={1}>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ display: "flex", justifyContent: "space-between" }}
        >
          <span>
            {simulationData && simulationData.agents
              ? `Agents: ${
                  simulationData.agents.filter((a) => a.status === 0).length
                } active`
              : "No data"}
          </span>
          <span>Scale: 1 unit = 1 meter</span>
        </Typography>
      </Box>
    </Paper>
  );
}
