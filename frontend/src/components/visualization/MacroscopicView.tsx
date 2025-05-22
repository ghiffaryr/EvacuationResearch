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
  Divider,
} from "@mui/material";
import * as d3 from "d3";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";

interface MacroscopicViewProps {
  simulationData?: {
    density: number[][][]; // [timestep][y][x]
    velocity_x: number[][][];
    velocity_y: number[][][];
    fire?: number[][][];
    earthquake?: number[][][]; // Add earthquake field
    flood?: number[][][]; // Add flood field
    evacuated_count?: number[];
    time_steps: number;
    grid_resolution: number;
    dt: number;
    building_layout?: {
      walls: [[number, number], [number, number]][];
      exits: [number, number][];
      hazards?: any[]; // Add hazards field to building_layout
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
        color="#ff7700"
        emissive="#ff9900"
        emissiveIntensity={0.3}
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
            <meshStandardMaterial color="#111111" /> {/* Darker walls */}
          </mesh>
        );
      })}

      {/* Exits */}
      {exits.map((exit, idx) => {
        const [x, y] = exit;
        return (
          <group key={idx}>
            <mesh position={[x - 10, 0, -y + 10]}>
              <boxGeometry args={[1.2, 0.2, 1.2]} />
              <meshStandardMaterial
                color="#00cc00"
                emissive="#00ff00"
                emissiveIntensity={0.5}
              />
            </mesh>
            {/* Add EXIT label */}
            <Text
              position={[x - 10, 0.5, -y + 10]}
              color="#ffffff"
              fontSize={0.3}
              anchorX="center"
              anchorY="middle"
            >
              EXIT
            </Text>
          </group>
        );
      })}

      {/* Add visible grid for reference */}
      <gridHelper args={[20, 20, "#999999", "#cccccc"]} position={[0, 0, 0]} />

      {/* Add axis helpers */}
      <axesHelper args={[5]} position={[-10, 0, -10]} />
    </>
  );
}

// Component for visualizing fire in 3D with improved visibility
function FireVisualization({
  data,
  color = "#ff3300", // Default fire color
}: {
  data: number[][];
  color?: string;
}) {
  const points: THREE.Vector3[] = [];
  const colors: THREE.Color[] = [];

  // Create base color from the provided color parameter
  const baseColor = new THREE.Color(color);

  // Create points for each hazard location
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

          // Create a color based on the base color but with variation for height
          const newColor = baseColor
            .clone()
            .lerp(new THREE.Color("#ffffff"), height * 0.2);
          colors.push(newColor);
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
        size={0.5} // Larger points
        vertexColors={true}
        transparent={true}
        opacity={0.9} // Higher opacity
        blending={THREE.AdditiveBlending}
        sizeAttenuation={true}
      />
    </points>
  );
}

// Update the EnvironmentElements component for 3D view
function EnvironmentElements({ hazards }: { hazards: any[] }) {
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
          const { type, position, dimensions = [1, 1], texture = "" } = hazard;

          let color = "#ffffff";
          let opacity = 1.0;
          let metalness = 0.0;
          let roughness = 0.5;

          // Determine material properties based on type
          if (type === "window") {
            color = hazard.is_transparent ? "#a6d8ff" : "#d4f1f9";
            opacity = hazard.is_transparent ? 0.3 : 0.8;
          } else if (type === "door") {
            color = "#8B4513"; // Brown for wooden door
          } else if (type === "floor") {
            // Set floor texture color
            if (texture === "wood") {
              color = "#D2B48C";
            } else if (texture === "concrete") {
              color = "#C0C0C0";
            } else if (texture === "carpet") {
              color = "#607D8B";
            } else {
              // tiles
              color = "#E0E0E0";
            }
          } else if (type === "ceiling") {
            if (texture === "exposed") {
              color = "#696969";
            } else if (texture === "tiles") {
              color = "#F5F5F5";
            } else {
              // plaster
              color = "#FFFFFF";
            }
          } else if (type === "soil") {
            if (texture === "clay") {
              color = "#A52A2A";
            } else if (texture === "sand") {
              color = "#F4A460";
            } else {
              // dirt
              color = "#8B4513";
            }
          } else if (type === "grass") {
            if (texture === "tall_grass") {
              color = "#228B22";
            } else if (texture === "moss") {
              color = "#2E8B57";
            } else {
              // regular grass
              color = "#7CFC00";
            }
          } else if (type === "chair") {
            if (texture === "metal") {
              color = "#A9A9A9";
              metalness = 0.7;
              roughness = 0.3;
            } else if (texture === "plastic") {
              color = "#1E90FF";
              metalness = 0.1;
              roughness = 0.9;
            } else if (texture === "fabric") {
              color = "#6495ED";
              metalness = 0.0;
              roughness = 1.0;
            } else {
              // wood
              color = "#8B4513";
              metalness = 0.1;
              roughness = 0.8;
            }
          } else if (type === "table") {
            if (texture === "metal") {
              color = "#A9A9A9";
              metalness = 0.7;
              roughness = 0.3;
            } else if (texture === "plastic") {
              color = "#E0E0E0";
              metalness = 0.1;
              roughness = 0.9;
            } else if (texture === "fabric") {
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

          // Calculate dimensions and position for rendering
          const width = dimensions[0];
          const length = dimensions[1];
          const x = position[0] - 10;
          const y = position[1] - 10;

          // Determine rendering height based on type
          let height = 0;
          if (type === "window") height = 1.5;
          else if (type === "door") height = 0.5;
          else if (type === "ceiling") height = hazard.height || 3.0;
          else if (type === "soil" || type === "grass") height = 0.1;
          else if (type === "chair") height = 0.4;
          else if (type === "table") height = 0.75;

          if (type === "chair") {
            return (
              <group key={`chair-${idx}`} position={[x, 0, y]}>
                {/* Chair seat */}
                <mesh position={[0, 0.4, 0]}>
                  <boxGeometry args={[width, 0.1, length]} />
                  <meshStandardMaterial
                    color={color}
                    metalness={metalness}
                    roughness={roughness}
                  />
                </mesh>

                {/* Chair back */}
                <mesh position={[0, 0.8, -length / 2 + 0.05]}>
                  <boxGeometry args={[width, 0.8, 0.1]} />
                  <meshStandardMaterial
                    color={color}
                    metalness={metalness}
                    roughness={roughness}
                  />
                </mesh>

                {/* Chair legs */}
                {[
                  [width / 2 - 0.05, 0.2, length / 2 - 0.05] as [
                    number,
                    number,
                    number
                  ],
                  [width / 2 - 0.05, 0.2, -length / 2 + 0.05] as [
                    number,
                    number,
                    number
                  ],
                  [-width / 2 + 0.05, 0.2, length / 2 - 0.05] as [
                    number,
                    number,
                    number
                  ],
                  [-width / 2 + 0.05, 0.2, -length / 2 + 0.05] as [
                    number,
                    number,
                    number
                  ],
                ].map((pos, legIdx) => (
                  <mesh key={`leg-${legIdx}`} position={pos}>
                    <cylinderGeometry args={[0.05, 0.05, 0.4, 8]} />
                    <meshStandardMaterial
                      color={color}
                      metalness={metalness}
                      roughness={roughness}
                    />
                  </mesh>
                ))}
              </group>
            );
          } else if (type === "table") {
            return (
              <group key={`table-${idx}`} position={[x, 0, y]}>
                {/* Table top */}
                <mesh position={[0, height, 0]}>
                  <boxGeometry args={[width, 0.1, length]} />
                  <meshStandardMaterial
                    color={color}
                    metalness={metalness}
                    roughness={roughness}
                  />
                </mesh>

                {/* Table legs */}
                {[
                  [width / 2 - 0.1, height / 2, length / 2 - 0.1] as [
                    number,
                    number,
                    number
                  ],
                  [width / 2 - 0.1, height / 2, -length / 2 + 0.1] as [
                    number,
                    number,
                    number
                  ],
                  [-width / 2 + 0.1, height / 2, length / 2 - 0.1] as [
                    number,
                    number,
                    number
                  ],
                  [-width / 2 + 0.1, height / 2, -length / 2 + 0.1] as [
                    number,
                    number,
                    number
                  ],
                ].map((pos, legIdx) => (
                  <mesh key={`leg-${legIdx}`} position={pos}>
                    <cylinderGeometry args={[0.08, 0.08, height, 8]} />
                    <meshStandardMaterial
                      color={color}
                      metalness={metalness}
                      roughness={roughness}
                    />
                  </mesh>
                ))}
              </group>
            );
          }
          // Different geometry types for different elements
          if (["window", "door"].includes(type)) {
            return (
              <mesh key={`env-${idx}`} position={[x, height, y]}>
                <boxGeometry args={[width, 0.1, length]} />
                <meshStandardMaterial
                  color={color}
                  transparent={opacity < 1.0}
                  opacity={opacity}
                />
              </mesh>
            );
          } else {
            return (
              <mesh
                key={`env-${idx}`}
                position={[x, height, y]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <planeGeometry args={[width, length]} />
                <meshStandardMaterial color={color} side={THREE.DoubleSide} />
              </mesh>
            );
          }
        })}
    </>
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
  const [visLayer, setVisLayer] = useState<
    "density" | "velocity" | "fire" | "earthquake" | "flood"
  >("density");
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

    // Draw background grid for better reference
    svg
      .append("rect")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .attr("fill", "#f8f8f8");

    // Draw grid lines for reference
    for (let i = 0; i <= gridResolution; i += 10) {
      // Draw every 10th gridline
      // Vertical lines
      svg
        .append("line")
        .attr("x1", (i / gridResolution) * innerWidth)
        .attr("y1", 0)
        .attr("x2", (i / gridResolution) * innerWidth)
        .attr("y2", innerHeight)
        .attr("stroke", "#dddddd")
        .attr("stroke-width", 1);

      // Horizontal lines
      svg
        .append("line")
        .attr("x1", 0)
        .attr("y1", (i / gridResolution) * innerHeight)
        .attr("x2", innerWidth)
        .attr("y2", (i / gridResolution) * innerHeight)
        .attr("stroke", "#dddddd")
        .attr("stroke-width", 1);

      // Add grid coordinates for scale reference
      if (i % 20 === 0) {
        // X coordinate
        svg
          .append("text")
          .attr("x", (i / gridResolution) * innerWidth)
          .attr("y", innerHeight + 15)
          .attr("text-anchor", "middle")
          .style("font-size", "10px")
          .text(((i / gridResolution) * 20).toFixed(0) + "m");

        // Y coordinate
        svg
          .append("text")
          .attr("x", -15)
          .attr("y", (i / gridResolution) * innerHeight)
          .attr("text-anchor", "end")
          .attr("dominant-baseline", "central")
          .style("font-size", "10px")
          .text(((i / gridResolution) * 20).toFixed(0) + "m");
      }
    }

    // Select appropriate data and color scales based on visualization layer
    let colorScale;
    let data: number[][];

    if (visLayer === "density") {
      data = simulationData.density[localTimeStep];
      // Use a perceptually uniform color scale from dark purple to yellow
      colorScale = d3
        .scaleSequential(d3.interpolateInferno)
        .domain([0, d3.max(data.flat()) || 10]);
    } else if (visLayer === "fire" && simulationData.fire) {
      data = simulationData.fire[localTimeStep];
      // Use appropriate fire color scale (yellow to red)
      colorScale = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, 1]);
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
      // Use blue-based color scale for velocity
      colorScale = d3
        .scaleSequential(d3.interpolatePuBu)
        .domain([0, d3.max(data.flat()) || 2]);
    }

    // Draw heatmap with improved rendering
    svg
      .selectAll("rect.heatmap")
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
      .attr("class", "heatmap")
      .attr("x", (d) => d.x * cellWidth)
      .attr("y", (d) => d.y * cellHeight)
      .attr("width", cellWidth)
      .attr("height", cellHeight)
      .attr("fill", (d) => colorScale(d.value))
      .attr("opacity", (d) =>
        Math.min(0.95, 0.3 + (d.value / (colorScale.domain()[1] || 1)) * 0.7)
      );

    // Draw velocity vectors with improved visibility
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
        .attr("stroke", "#000000") // Black for better visibility
        .attr("stroke-width", 1.5) // Thicker lines
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

    // Draw building layout with higher contrast
    if (simulationData.building_layout) {
      // Draw walls with better visibility
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
            .attr("stroke", "#000000") // Solid black walls
            .attr("stroke-width", 4) // Thicker walls
            .attr("stroke-linecap", "round"); // Rounded ends
        });
      }

      // Draw exits with higher contrast and visual indicators
      if (simulationData.building_layout.exits) {
        simulationData.building_layout.exits.forEach((exit) => {
          const [x, y] = exit;
          const scaledX = ((x * gridResolution) / 20) * cellWidth;
          const scaledY = ((y * gridResolution) / 20) * cellHeight;

          // Draw black border for exit
          svg
            .append("rect")
            .attr("x", scaledX - cellWidth - 2)
            .attr("y", scaledY - cellHeight - 2)
            .attr("width", cellWidth * 2 + 4)
            .attr("height", cellHeight * 2 + 4)
            .attr("fill", "#000000");

          // Draw exit
          svg
            .append("rect")
            .attr("x", scaledX - cellWidth)
            .attr("y", scaledY - cellHeight)
            .attr("width", cellWidth * 2)
            .attr("height", cellHeight * 2)
            .attr("fill", "#00cc00") // Brighter green
            .attr("opacity", 1.0); // Full opacity

          // Add "EXIT" text
          svg
            .append("text")
            .attr("x", scaledX)
            .attr("y", scaledY + 4)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-size", "10px")
            .attr("font-weight", "bold")
            .attr("fill", "#ffffff")
            .text("EXIT");
        });
      }
    }

    // Add comprehensive title and axis labels
    svg
      .append("text")
      .attr("x", innerWidth / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .text(
        `Macroscopic ${
          visLayer.charAt(0).toUpperCase() + visLayer.slice(1)
        } Field`
      );

    svg
      .append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + margin.bottom - 5)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text("X-position (meters)");

    svg
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -margin.left + 12)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Y-position (meters)");

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
    newLayer: "density" | "velocity" | "fire" | "earthquake" | "flood" | null
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
        <Typography
          component="span"
          variant="subtitle2"
          sx={{ ml: 1, color: "text.secondary" }}
        >
          (Continuum Model)
        </Typography>
      </Typography>

      {/* Academic description */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mb: 1, display: "block" }}
      >
        Representing evacuation dynamics as continuous density and velocity
        fields using partial differential equations.
      </Typography>

      {/* Add comprehensive legend */}
      <Box
        sx={{
          mb: 2,
          p: 1,
          border: "1px solid #e0e0e0",
          borderRadius: 1,
          bgcolor: "#f9f9f9",
        }}
      >
        <Typography variant="subtitle2" gutterBottom>
          Legend:
        </Typography>
        <Grid container spacing={2}>
          {visLayer === "density" && (
            <Grid item xs={12} md={4}>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    background:
                      "linear-gradient(to top, #000004, #781c6d, #ed6925, #fcfdbf)" /* Inferno */,
                    mr: 1,
                  }}
                />
                <Typography variant="caption">
                  Population Density (people/m²)
                </Typography>
              </Box>
            </Grid>
          )}

          {visLayer === "velocity" && (
            <Grid item xs={12} md={4}>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    background:
                      "linear-gradient(to top, #fff7fb, #023858)" /* PuBu */,
                    mr: 1,
                  }}
                />
                <Typography variant="caption">Flow Velocity (m/s)</Typography>
              </Box>
            </Grid>
          )}

          {visLayer === "fire" && (
            <Grid item xs={12} md={4}>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    background:
                      "linear-gradient(to top, #ffffcc, #fd8d3c, #800026)" /* YlOrRd */,
                    mr: 1,
                  }}
                />
                <Typography variant="caption">Fire Intensity (0-1)</Typography>
              </Box>
            </Grid>
          )}

          <Grid
            item
            xs={6}
            md={4}
            sx={{ display: "flex", alignItems: "center" }}
          >
            <Box
              sx={{
                width: 16,
                height: 16,
                backgroundColor: "#000000",
                mr: 1,
              }}
            />
            <Typography variant="caption">Wall</Typography>
          </Grid>

          <Grid
            item
            xs={6}
            md={4}
            sx={{ display: "flex", alignItems: "center" }}
          >
            <Box
              sx={{
                width: 16,
                height: 16,
                backgroundColor: "#00cc00",
                mr: 1,
              }}
            />
            <Typography variant="caption">Exit</Typography>
          </Grid>

          <Grid
            item
            xs={12}
            md={12}
            sx={{ display: "flex", alignItems: "center" }}
          >
            <Typography variant="caption">
              Scale: Grid resolution: {simulationData?.grid_resolution || 100}×
              {simulationData?.grid_resolution || 100}, Domain size: 20m×20m
            </Typography>
          </Grid>
        </Grid>
      </Box>

      {/* View mode and visualization layer controls */}
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
            {simulationData.earthquake && (
              <ToggleButton value="earthquake">Earthquake</ToggleButton>
            )}
            {simulationData.flood && (
              <ToggleButton value="flood">Flood</ToggleButton>
            )}
          </ToggleButtonGroup>
        </Grid>
      </Grid>

      <Divider sx={{ mb: 2 }} />

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
              <FireVisualization
                data={simulationData.fire[localTimeStep]}
                color="#ff3300"
              />
            )}

            {visLayer === "earthquake" && simulationData.earthquake && (
              <FireVisualization
                data={simulationData.earthquake[localTimeStep]}
                color="#8800bb"
              />
            )}

            {visLayer === "flood" && simulationData.flood && (
              <FireVisualization
                data={simulationData.flood[localTimeStep]}
                color="#0066ff"
              />
            )}

            {/* Add environment elements visualization */}
            {simulationData.building_layout &&
              simulationData.building_layout.hazards && (
                <EnvironmentElements
                  hazards={simulationData.building_layout.hazards}
                />
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
              Evacuated: {currentEvacuated} people
            </Typography>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
}
