# AI-Optimized Multi-Scale Evacuation System

This project implements a multi-scale evacuation simulation and optimization framework for smart buildings, as described in the research paper "AI-Optimized Multi-Scale Evacuation for Smart Buildings: From Agent Panic to Citywide Safety."

## Overview

The system integrates three scales of crowd dynamics modeling:

- **Microscopic**: Agent-based Social Force Model with panic calibration (α_panic = 1.2)
- **Mesoscopic**: Boltzmann-type kinetic equations for intermediate scale dynamics
- **Macroscopic**: PDE-based modeling of crowd flow with hazard coupling

The system uses GPU-accelerated AI optimization (Reinforcement Learning) to dynamically optimize evacuation strategies while maintaining fairness in exit allocation.

## Features

- Multi-scale simulation capabilities (microscopic, mesoscopic, macroscopic)
- GPU-accelerated reinforcement learning for evacuation optimization
- Fairness-constrained optimization for equitable exit allocation
- Interactive 2D and 3D visualizations
- Support for multiple hazard types (fire, flood, structural damage)
- Scenario editor for creating and managing evacuation scenarios

## Technology Stack

- **Backend**: Python, Falcon, PyTorch
- **Frontend**: React, TypeScript, Vite, Material UI, Three.js
- **Deployment**: Docker, Docker Compose

## Getting Started

### Prerequisites

- Docker and Docker Compose
- NVIDIA GPU with CUDA support (recommended)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/smart-evacuation.git
   cd smart-evacuation
   ```

2. Build and run using Docker Compose:
   ```
   docker-compose up --build
   ```

3. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000

## System Architecture

The system follows a client-server architecture:

- **Backend**: RESTful API built with Falcon, implementing AI models and simulation logic
- **Frontend**: React-based UI for visualization and interaction
- **Docker**: Containerization for easy deployment and scaling

### Key Components

- `backend/models/microscopic`: Social Force Model implementation
- `backend/models/mesoscopic`: Boltzmann-type kinetic model
- `backend/models/macroscopic`: PDE-based crowd flow model
- `backend/models/training`: Reinforcement learning for evacuation optimization
- `frontend/src/components/visualization`: Interactive 2D and 3D visualizations

## Usage

1. **Create a Scenario**: Use the scenario editor to define building layouts, exits, and hazards
2. **Run Simulations**: Choose a scenario and run simulations at different scales
3. **Train AI Models**: Train evacuation optimization models using the training interface
4. **Evaluate Performance**: Analyze evacuation times, success rates, and fairness metrics

## Research Background

This implementation is based on the research integrating multi-scale crowd dynamics with GPU-accelerated AI optimization for emergency evacuation safety. The work unifies microscopic agent-based models (α_panic = 1.2), mesoscopic kinetic theory, and macroscopic PDEs to develop a panic-calibrated system that dynamically adapts to multi-hazard scenarios.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by research in evacuation dynamics, crowd modeling, and AI optimization
- Uses PyTorch for deep reinforcement learning
- Three.js and D3.js for visualization
