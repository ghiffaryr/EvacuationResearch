import { useRef, useEffect, useState } from "react";
import {
  Box,
  Button,
  Slider,
  Typography,
  Paper,
  Grid,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import * as d3 from "d3";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

interface MacroscopicViewProps {
  simulationData?: {
    density: number[][][]; // [timestep][y][x]
    velocity_x: number[][][];
    velocity_y: number[][][];
    fire?: number[][][];
    evacuated_count?: number[];
    time_steps: number;
    grid_resolution: number;
    dt: number;
    building_layout?: {
      walls: [[number, number], [number, number]][];
      exits: [number, number][];
    };
  };
  timeStep?: number;
  onTimeStepChange?: (timeStep: number) => void;
}

// 3D visualization of the density field
function DensityMesh({
  data,
  resolution,
}: {
  data: number[][];
  resolution: number;
}) {
  const { scene: _ } = useThree(); // Rename to _ to mark as intentionally unused
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (!meshRef.current) return;

    // Create a plane geometry with resolution x resolution vertices
    const geometry = new THREE.PlaneGeometry(
      20,
      20,
      resolution - 1,
      resolution - 1
    );

    // Get the position attribute from the geometry
    const position = geometry.getAttribute("position");

    // Update the z-coordinate of each vertex to create a height field
    for (let i = 0; i < position.count; i++) {
      const x = Math.floor(((i % resolution) / resolution) * resolution);
      const y = Math.floor(i / resolution);

      if (x < data.length && y < data[0].length) {
        // Set the z position based on the density value
        position.setZ(i, data[y][x] * 2);
      }
    }

    // Update the geometry
    position.needsUpdate = true;
    geometry.computeVertexNormals();

    // Update the mesh with the new geometry
    meshRef.current.geometry.dispose();
    meshRef.current.geometry = geometry;
  }, [data, resolution]);

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[-10, 0, 10]}>
      <planeGeometry args={[20, 20, resolution - 1, resolution - 1]} />
      <meshStandardMaterial
        color="#ff9500"
        side={THREE.DoubleSide}
        wireframe={false}
        flatShading={true}
        vertexColors={true}
      />
    </mesh>
  );
}

// Component for drawing walls and exits in 3D
function BuildingLayout({
  walls,
  exits,
}: {
  walls: [[number, number], [number, number]][];
  exits: [number, number][];
}) {
  return (
    <>
      {/* Walls */}
      {walls.map((wall, idx) => {
        const [[x1, y1], [x2, y2]] = wall;
        const start = new THREE.Vector3(x1 - 10, 0.5, -y1 + 10);
        const end = new THREE.Vector3(x2 - 10, 0.5, -y2 + 10);

        const direction = new THREE.Vector3().subVectors(end, start);
        const length = direction.length();
        direction.normalize();

        const center = new THREE.Vector3()
          .addVectors(start, end)
          .multiplyScalar(0.5);

        // Calculate rotation from direction
        const quaternion = new THREE.Quaternion();
        if (Math.abs(direction.x) > Math.abs(direction.z)) {
          // Wall is more horizontal
          const angle = Math.atan2(direction.z, direction.x);
          quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        } else {
          // Wall is more vertical
          const angle = Math.atan2(direction.x, direction.z);
          quaternion.setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            -angle + Math.PI / 2
          );
        }

        return (
          <mesh
            key={idx}
            position={[center.x, center.y, center.z]}
            quaternion={quaternion}
          >
            <boxGeometry args={[length, 1, 0.1]} />
            <meshStandardMaterial color="#444444" />
          </mesh>
        );
      })}

      {/* Exits */}
      {exits.map((exit, idx) => {
        const [x, y] = exit;
        return (
          <mesh key={idx} position={[x - 10, 0, -y + 10]}>
            <boxGeometry args={[1, 0.2, 1]} />
            <meshStandardMaterial color="#00ff00" transparent opacity={0.7} />
          </mesh>
        );
      })}
    </>
  );
}

// Component for visualizing fire in 3D
function FireVisualization({ data }: { data: number[][] }) {
  const points: THREE.Vector3[] = [];
  const colors: THREE.Color[] = [];

  // Create points for each fire location
  for (let y = 0; y < data.length; y++) {
    for (let x = 0; x < data[y].length; x++) {
      const intensity = data[y][x];

      if (intensity > 0.05) {
        // Add multiple points with some randomness for a more natural look
        const numPoints = Math.ceil(intensity * 5);

        for (let i = 0; i < numPoints; i++) {
          const offsetX = (Math.random() - 0.5) * 0.5;
          const offsetY = (Math.random() - 0.5) * 0.5;
          const height = 0.5 + intensity * 2 * Math.random();

          points.push(
            new THREE.Vector3(
              x - data.length / 2 + offsetX,
              height,
              y - data[0].length / 2 + offsetY
            )
          );

          // Color gradient from yellow to red based on height
          const color = new THREE.Color();
          color.setHSL(0.05 - intensity * 0.05, 1, 0.5 + height * 0.2);
          colors.push(color);
        }
      }
    }
  }

  const pointsGeometry = new THREE.BufferGeometry().setFromPoints(points);
  pointsGeometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(
      colors.flatMap((color) => [color.r, color.g, color.b]),
      3
    )
  );

  return (
    <points>
      <bufferGeometry {...pointsGeometry} />
      <pointsMaterial
        size={0.3}
        vertexColors={true}
        transparent={true}
        opacity={0.8}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function MacroscopicView({
  simulationData,
  timeStep = 0,
  onTimeStepChange,
}: MacroscopicViewProps) {
  const [localTimeStep, setLocalTimeStep] = useState(timeStep);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [visLayer, setVisLayer] = useState<"density" | "velocity" | "fire">(
    "density"
  );
  const svgRef = useRef<SVGSVGElement | null>(null);
  const animationRef = useRef<number>();
  const lastUpdateTimeRef = useRef<number>(0);

  // Use provided timeStep if it's controlled from parent
  useEffect(() => {
    setLocalTimeStep(timeStep);
  }, [timeStep]);

  // 2D visualization using D3
  useEffect(() => {
    if (!simulationData || !svgRef.current || viewMode !== "2d") return;

    const width = 500;
    const height = 500;
    const margin = { top: 20, right: 30, bottom: 20, left: 20 };

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const gridResolution = simulationData.grid_resolution;
    const cellWidth = innerWidth / gridResolution;
    const cellHeight = innerHeight / gridResolution;

    let colorScale;
    let data: number[][];

    // Select the appropriate data based on visualization layer
    if (visLayer === "density") {
      data = simulationData.density[localTimeStep];
      colorScale = d3
        .scaleSequential(d3.interpolateYlOrRd)
        .domain([0, d3.max(data.flat()) || 10]);
    } else if (visLayer === "fire" && simulationData.fire) {
      data = simulationData.fire[localTimeStep];
      colorScale = d3.scaleSequential(d3.interpolateOrRd).domain([0, 1]);
    } else {
      // Velocity magnitude
      data = simulationData.velocity_x[localTimeStep].map((row, i) =>
        row.map((vx, j) =>
          Math.sqrt(
            vx * vx +
              simulationData.velocity_y[localTimeStep][i][j] *
                simulationData.velocity_y[localTimeStep][i][j]
          )
        )
      );
      colorScale = d3
        .scaleSequential(d3.interpolateBlues)
        .domain([0, d3.max(data.flat()) || 2]);
    }

    // Draw heatmap
    svg
      .selectAll("rect")
      .data(
        data.flat().map((value, i) => {
          const x = i % gridResolution;
          const y = Math.floor(i / gridResolution);
          return {
            x,
            y,
            value,
            velocity_x: simulationData.velocity_x[localTimeStep][y][x],
            velocity_y: simulationData.velocity_y[localTimeStep][y][x],
            fire: simulationData.fire
              ? simulationData.fire[localTimeStep][y][x]
              : 0,
          };
        })
      )
      .enter()
      .append("rect")
      .attr("x", (d) => d.x * cellWidth)
      .attr("y", (d) => d.y * cellHeight)
      .attr("width", cellWidth)
      .attr("height", cellHeight)
      .attr("fill", (d) => colorScale(d.value))
      .attr("stroke", "none");

    // Draw velocity vectors if showing velocity layer
    if (visLayer === "velocity") {
      // Sample velocity vectors (show every nth cell)
      const vectorSamplingRate = Math.max(1, Math.floor(gridResolution / 25));

      const vectors = [];
      for (let y = 0; y < gridResolution; y += vectorSamplingRate) {
        for (let x = 0; x < gridResolution; x += vectorSamplingRate) {
          const vx = simulationData.velocity_x[localTimeStep][y][x];
          const vy = simulationData.velocity_y[localTimeStep][y][x];

          // Only draw vectors with significant magnitude
          if (Math.sqrt(vx * vx + vy * vy) > 0.1) {
            vectors.push({
              x,
              y,
              vx,
              vy,
            });
          }
        }
      }

      // Draw vectors
      svg
        .selectAll("line.vector")
        .data(vectors)
        .enter()
        .append("line")
        .attr("class", "vector")
        .attr("x1", (d) => (d.x + 0.5) * cellWidth)
        .attr("y1", (d) => (d.y + 0.5) * cellHeight)
        .attr("x2", (d) => (d.x + 0.5 + d.vx * 0.8) * cellWidth)
        .attr("y2", (d) => (d.y + 0.5 + d.vy * 0.8) * cellHeight)
        .attr("stroke", "#000000")
        .attr("stroke-width", 1)
        .attr("marker-end", "url(#arrow)");

      // Add arrow marker for velocity vectors
      svg
        .append("defs")
        .append("marker")
        .attr("id", "arrow")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 8)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#000000");
    }

    // Draw building layout if available
    if (simulationData.building_layout) {
      // Draw walls
      if (simulationData.building_layout.walls) {
        simulationData.building_layout.walls.forEach((wall) => {
          const [[x1, y1], [x2, y2]] = wall;
          const scaledX1 = ((x1 * gridResolution) / 20) * cellWidth;
          const scaledY1 = ((y1 * gridResolution) / 20) * cellHeight;
          const scaledX2 = ((x2 * gridResolution) / 20) * cellWidth;
          const scaledY2 = ((y2 * gridResolution) / 20) * cellHeight;

          svg
            .append("line")
            .attr("x1", scaledX1)
            .attr("y1", scaledY1)
            .attr("x2", scaledX2)
            .attr("y2", scaledY2)
            .attr("stroke", "#444444")
            .attr("stroke-width", 3);
        });
      }

      // Draw exits
      if (simulationData.building_layout.exits) {
        simulationData.building_layout.exits.forEach((exit) => {
          const [x, y] = exit;
          const scaledX = ((x * gridResolution) / 20) * cellWidth;
          const scaledY = ((y * gridResolution) / 20) * cellHeight;

          svg
            .append("rect")
            .attr("x", scaledX - cellWidth)
            .attr("y", scaledY - cellHeight)
            .attr("width", cellWidth * 2)
            .attr("height", cellHeight * 2)
            .attr("fill", "#00ff00")
            .attr("opacity", 0.7);
        });
      }
    }

    // Add colorbar
    const legendWidth = 20;
    const legendHeight = innerHeight;

    // Create gradient
    const gradientId = `${visLayer}-gradient`;
    const gradient = svg
      .append("defs")
      .append("linearGradient")
      .attr("id", gradientId)
      .attr("x1", "0%")
      .attr("y1", "100%")
      .attr("x2", "0%")
      .attr("y2", "0%");

    // Add color stops
    const stops = 10;
    for (let i = 0; i <= stops; i++) {
      gradient
        .append("stop")
        .attr("offset", `${(i / stops) * 100}%`)
        .attr("stop-color", colorScale((i / stops) * colorScale.domain()[1]));
    }

    // Draw legend rectangle
    svg
      .append("rect")
      .attr("x", innerWidth + 10)
      .attr("y", 0)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .attr("fill", `url(#${gradientId})`);

    // Add legend axis
    const legendScale = d3
      .scaleLinear()
      .domain(colorScale.domain())
      .range([legendHeight, 0]);

    const legendAxis = d3.axisRight(legendScale).ticks(5);

    svg
      .append("g")
      .attr("transform", `translate(${innerWidth + 10 + legendWidth}, 0)`)
      .call(legendAxis);

    // Add legend title
    svg
      .append("text")
      .attr(
        "transform",
        `translate(${innerWidth + 10 + legendWidth / 2}, ${-10})`
      )
      .style("text-anchor", "middle")
      .text(
        visLayer === "density"
          ? "Density"
          : visLayer === "fire"
          ? "Fire Intensity"
          : "Velocity"
      );
  }, [simulationData, localTimeStep, viewMode, visLayer]);

  // Animation effect
  useEffect(() => {
    if (!isPlaying || !simulationData) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const totalTimeSteps = simulationData.time_steps;

    const animate = (time: number) => {
      if (time - lastUpdateTimeRef.current >= 100) {
        // Update every 100ms
        const newTimeStep = (localTimeStep + 1) % totalTimeSteps;
        setLocalTimeStep(newTimeStep);

        if (onTimeStepChange) {
          onTimeStepChange(newTimeStep);
        }

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
  }, [isPlaying, localTimeStep, simulationData, onTimeStepChange]);

  const handleTimeStepChange = (_: Event, newValue: number | number[]) => {
    const newTimeStep = newValue as number;
    setLocalTimeStep(newTimeStep);

    if (onTimeStepChange) {
      onTimeStepChange(newTimeStep);
    }
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleViewModeChange = (
    _: React.MouseEvent<HTMLElement>,
    newMode: "2d" | "3d" | null
  ) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };

  const handleVisLayerChange = (
    _: React.MouseEvent<HTMLElement>,
    newLayer: "density" | "velocity" | "fire" | null
  ) => {
    if (newLayer !== null) {
      setVisLayer(newLayer);
    }
  };

  if (!simulationData) {
    return (
      <Paper elevation={3} sx={{ p: 2, height: "100%" }}>
        <Typography variant="h6" gutterBottom>
          Macroscopic Simulation
        </Typography>
        <Box
          sx={{
            height: 400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography variant="body1">No simulation data available</Typography>
        </Box>
      </Paper>
    );
  }

  const currentTime = (localTimeStep * simulationData.dt).toFixed(1);
  const currentEvacuated = simulationData.evacuated_count
    ? simulationData.evacuated_count[localTimeStep].toFixed(0)
    : "N/A";

  return (
    <Paper
      elevation={3}
      sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column" }}
    >
      <Typography variant="h6" gutterBottom>
        Macroscopic Simulation
      </Typography>

      <Grid container spacing={2} mb={2}>
        <Grid item>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            size="small"
          >
            <ToggleButton value="2d">2D View</ToggleButton>
            <ToggleButton value="3d">3D View</ToggleButton>
          </ToggleButtonGroup>
        </Grid>
        <Grid item>
          <ToggleButtonGroup
            value={visLayer}
            exclusive
            onChange={handleVisLayerChange}
            size="small"
          >
            <ToggleButton value="density">Density</ToggleButton>
            <ToggleButton value="velocity">Velocity</ToggleButton>
            {simulationData.fire && (
              <ToggleButton value="fire">Fire</ToggleButton>
            )}
          </ToggleButtonGroup>
        </Grid>
      </Grid>

      <Box sx={{ flexGrow: 1, overflow: "hidden", minHeight: 400 }}>
        {viewMode === "2d" ? (
          <svg
            ref={svgRef}
            style={{ width: "100%", height: "100%", display: "block" }}
          ></svg>
        ) : (
          <Canvas camera={{ position: [0, 15, 15], fov: 60 }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />

            {/* 3D visualization based on selected layer */}
            {visLayer === "density" && (
              <DensityMesh
                data={simulationData.density[localTimeStep]}
                resolution={simulationData.grid_resolution}
              />
            )}

            {visLayer === "fire" && simulationData.fire && (
              <FireVisualization data={simulationData.fire[localTimeStep]} />
            )}

            {/* Building layout */}
            {simulationData.building_layout && (
              <BuildingLayout
                walls={simulationData.building_layout.walls || []}
                exits={simulationData.building_layout.exits || []}
              />
            )}

            <OrbitControls />
            <gridHelper args={[20, 20]} />
          </Canvas>
        )}
      </Box>

      <Grid container spacing={2} alignItems="center" sx={{ mt: 2 }}>
        <Grid item xs={2}>
          <Button variant="contained" onClick={handlePlayPause}>
            {isPlaying ? "Pause" : "Play"}
          </Button>
        </Grid>
        <Grid item xs={8}>
          <Slider
            value={localTimeStep}
            onChange={handleTimeStepChange}
            min={0}
            max={simulationData.time_steps - 1}
            step={1}
            valueLabelDisplay="auto"
          />
        </Grid>
        <Grid item xs={2}>
          <Typography>
            Step: {localTimeStep}/{simulationData.time_steps - 1}
          </Typography>
        </Grid>
      </Grid>

      <Box mt={2}>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="body2" color="text.secondary">
              Time: {currentTime}s
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="text.secondary">
              Evacuated: {currentEvacuated}
            </Typography>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
}
