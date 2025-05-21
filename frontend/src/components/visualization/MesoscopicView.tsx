import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Paper, Typography, Box, Button, Slider, Grid } from "@mui/material";

interface MesoscopicViewProps {
  simulationData: any;
  onTimeStepChange?: (timeStep: number) => void;
}

interface CellData {
  x: number;
  y: number;
  value: number;
  velocity_x: number;
  velocity_y: number;
}

const MesoscopicView: React.FC<MesoscopicViewProps> = ({
  simulationData,
  onTimeStepChange,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const [localTimeStep, setLocalTimeStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  useEffect(() => {
    if (!simulationData || !svgRef.current) {
      return;
    }

    console.log("Rendering mesoscopic data", {
      hasData: !!simulationData,
      dimensions: simulationData.density
        ? `${simulationData.density.length}x${simulationData.density[0]?.length}x${simulationData.density[0]?.[0]?.length}`
        : "missing",
      timeStep: localTimeStep,
    });

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth || 500;
    const height = svgRef.current.clientHeight || 500;

    const margin = { top: 10, right: 30, bottom: 30, left: 40 };

    svg
      .append("g")
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const gridSize = simulationData.grid_size;
    const cellWidth = innerWidth / gridSize;
    const cellHeight = innerHeight / gridSize;

    // Create color scale for density
    let maxDensity = 10; // Default if we can't determine from data
    try {
      // Safely check for data existence and compute max
      if (
        simulationData.density &&
        simulationData.density[localTimeStep] &&
        Array.isArray(simulationData.density[localTimeStep])
      ) {
        maxDensity =
          d3.max(simulationData.density[localTimeStep].flat() as number[]) ||
          10;
      }
    } catch (err) {
      console.error("Error computing max density:", err);
    }

    const colorScale = d3
      .scaleSequential(d3.interpolateYlOrRd)
      .domain([0, maxDensity]);

    // Safely prepare the data
    let cellsData: CellData[] = []; // Explicitly type cellsData
    try {
      if (
        simulationData.density &&
        simulationData.density[localTimeStep] &&
        Array.isArray(simulationData.density[localTimeStep])
      ) {
        const densityData = simulationData.density[localTimeStep];

        // Build cell data as an array of CellData objects
        for (let y = 0; y < densityData.length; y++) {
          for (let x = 0; x < densityData[y].length; x++) {
            cellsData.push({
              x,
              y,
              value: densityData[y][x],
              velocity_x:
                simulationData.velocity_x?.[localTimeStep]?.[y]?.[x] || 0,
              velocity_y:
                simulationData.velocity_y?.[localTimeStep]?.[y]?.[x] || 0,
            });
          }
        }
      }
    } catch (err) {
      console.error("Error preparing cell data:", err);
      cellsData = []; // Reset on error
    }

    svg
      .selectAll("rect")
      .data(cellsData)
      .enter()
      .append("rect")
      .attr("x", (d: CellData) => d.x * cellWidth)
      .attr("y", (d: CellData) => d.y * cellHeight)
      .attr("width", cellWidth)
      .attr("height", cellHeight)
      .attr("fill", (d: CellData) => colorScale(d.value))
      .attr("stroke", "none");

    // Draw velocity vectors (only show some for clarity)
    if (simulationData.velocity_x && simulationData.velocity_y) {
      // Sample velocity vectors (show every nth cell)
      const vectorSamplingRate = Math.max(1, Math.floor(gridSize / 20));

      const vectors = [];
      for (let y = 0; y < gridSize; y += vectorSamplingRate) {
        for (let x = 0; x < gridSize; x += vectorSamplingRate) {
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
        .selectAll("line")
        .data(vectors)
        .enter()
        .append("line")
        .attr("x1", (d) => (d.x + 0.5) * cellWidth)
        .attr("y1", (d) => (d.y + 0.5) * cellHeight)
        .attr("x2", (d) => (d.x + 0.5 + d.vx * 0.8) * cellWidth)
        .attr("y2", (d) => (d.y + 0.5 + d.vy * 0.8) * cellHeight)
        .attr("stroke", "#000000")
        .attr("stroke-width", 1)
        .attr("marker-end", "url(#arrow)");
    }

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

    // Draw walls
    if (simulationData.walls) {
      simulationData.walls.forEach((wall: any) => {
        const [[x1, y1], [x2, y2]] = wall;
        const scaledX1 = ((x1 * gridSize) / 20) * cellWidth;
        const scaledY1 = ((y1 * gridSize) / 20) * cellHeight;
        const scaledX2 = ((x2 * gridSize) / 20) * cellWidth;
        const scaledY2 = ((y2 * gridSize) / 20) * cellHeight;

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
    if (simulationData.exits) {
      simulationData.exits.forEach((exit: any) => {
        const [x, y] = exit;
        const scaledX = ((x * gridSize) / 20) * cellWidth;
        const scaledY = ((y * gridSize) / 20) * cellHeight;

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

    // Add colorbar
    const legendWidth = 20;
    const legendHeight = innerHeight;

    // Create gradient
    const gradient = svg
      .append("defs")
      .append("linearGradient")
      .attr("id", "density-gradient")
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
      .attr("fill", "url(#density-gradient)");

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
      .text("Density");
  }, [simulationData, localTimeStep]);

  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const totalTimeSteps = simulationData?.time_steps || 100;

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

  if (!simulationData) {
    return (
      <Paper elevation={3} sx={{ p: 2, height: "100%" }}>
        <Typography variant="h6" gutterBottom>
          Mesoscopic Simulation
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

  // Add a function to safely access density data
  const getSafeDensitySum = () => {
    try {
      if (simulationData?.density?.[localTimeStep]) {
        return simulationData.density[localTimeStep]
          .flat()
          .reduce((a: number, b: number) => a + b, 0)
          .toFixed(2);
      }
      return "0.00";
    } catch (err) {
      return "0.00";
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column" }}
    >
      <Typography variant="h6" gutterBottom>
        Mesoscopic Simulation
        {simulationData?.mock_data && (
          <span
            style={{
              fontSize: "0.8rem",
              color: "#666",
              marginLeft: "8px",
            }}
          >
            (Mock Data)
          </span>
        )}
      </Typography>

      <Box sx={{ flexGrow: 1, overflow: "hidden" }}>
        <svg
          ref={svgRef}
          style={{ width: "100%", height: "100%", display: "block" }}
        ></svg>
      </Box>

      {simulationData && (
        <>
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
            <Typography variant="body2" color="text.secondary">
              Total occupancy: {getSafeDensitySum()} people
            </Typography>
          </Box>
        </>
      )}
    </Paper>
  );
};

export default MesoscopicView;
