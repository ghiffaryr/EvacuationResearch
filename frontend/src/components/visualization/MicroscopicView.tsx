import { useRef, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Box, Button, Slider, Typography, Paper, Grid } from "@mui/material";
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
            <meshStandardMaterial color="#444444" />
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
          <meshStandardMaterial color="#00ff00" transparent opacity={0.7} />
        </mesh>
      ))}
    </>
  );
}

function Hazards({ hazards }: { hazards: Hazard[] }) {
  return (
    <>
      {hazards.map((hazard, idx) => {
        let color = "#ff0000"; // Default fire color

        if (hazard.type === "water") {
          color = "#0000ff";
        } else if (hazard.type === "structural") {
          color = "#8b4513";
        }

        return (
          <mesh key={idx} position={hazard.position}>
            <sphereGeometry args={[hazard.radius, 32, 32]} />
            <meshStandardMaterial
              color={color}
              transparent
              opacity={Math.min(0.8, hazard.intensity * 0.8)}
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
        const color = agent.status === 0 ? "#1976d2" : "#4caf50";
        const isActive = agent.status === 0;

        // Skip rendering agents that have been evacuated
        if (!isActive && agent.position[0] < -100) return null;

        return (
          <mesh key={idx} position={agent.position}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color={color} />

            {/* Add velocity vector indicator for active agents */}
            {isActive && agent.velocity && (
              <arrowHelper
                args={[
                  new THREE.Vector3(
                    agent.velocity[0],
                    agent.velocity[1],
                    agent.velocity[2]
                  ).normalize(),
                  new THREE.Vector3(0, 0, 0),
                  0.5,
                  0xffff00,
                ]}
              />
            )}
          </mesh>
        );
      })}
    </>
  );
}

function Scene({
  simulationData,
}: {
  simulationData?: MicroscopicViewProps["simulationData"];
}) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />

      {/* Display simulation elements if data is available */}
      {simulationData && (
        <>
          <Walls walls={simulationData.walls} />
          <Exits exits={simulationData.exits} />
          <Hazards hazards={simulationData.hazards} />
          <Agents agents={simulationData.agents} />

          {/* Ground plane */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
            <planeGeometry args={[50, 50]} />
            <meshStandardMaterial color="#e0e0e0" />
          </mesh>
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

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <Paper
      elevation={3}
      sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column" }}
    >
      <Typography variant="h6" gutterBottom>
        Microscopic Simulation
      </Typography>

      <Box sx={{ height: 500, mb: 2 }}>
        <Canvas camera={{ position: [0, 10, 20], fov: 60 }}>
          <Scene simulationData={simulationData} />
          <OrbitControls />
        </Canvas>
      </Box>

      <Grid container spacing={2} alignItems="center">
        <Grid item xs={2}>
          <Button variant="contained" onClick={handlePlayPause}>
            {isPlaying ? "Pause" : "Play"}
          </Button>
        </Grid>
        <Grid item xs={8}>
          <Slider
            value={timeStep}
            onChange={handleTimeStepChange}
            min={0}
            max={totalTimeSteps - 1}
            step={1}
            valueLabelDisplay="auto"
          />
        </Grid>
        <Grid item xs={2}>
          <Typography>
            Step: {timeStep}/{totalTimeSteps - 1}
          </Typography>
        </Grid>
      </Grid>

      <Box mt={2}>
        <Typography variant="body2" color="text.secondary">
          {simulationData && simulationData.agents
            ? `Agents: ${
                simulationData.agents.filter((a) => a.status === 0).length
              } active`
            : "No data"}
        </Typography>
      </Box>
    </Paper>
  );
}
