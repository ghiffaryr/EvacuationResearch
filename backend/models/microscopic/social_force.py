import numpy as np
import torch
import logging
import os

logger = logging.getLogger(__name__)

class SocialForceModel:
    """
    Implementation of the Social Force Model with panic calibration.
    Based on Helbing's Social Force Model with panic factor α_panic = 1.2.
    """
    
    def __init__(self, use_gpu=True):
        self.device = torch.device("cuda" if torch.cuda.is_available() and use_gpu else "cpu")
        self.panic_factor = 1.2  # α_panic from the research
        self.relaxation_time = 0.5  # τ parameter
        self.desired_speed = 1.4  # v0 parameter (m/s)
        self.agent_radius = 0.3  # meters
        
    def _calculate_desired_force(self, positions, velocities, goals):
        """Calculate the force driving agents toward their goals."""
        directions = goals - positions
        distances = torch.norm(directions, dim=1, keepdim=True)
        # Avoid division by zero
        mask = distances > 0.01
        normalized_directions = torch.zeros_like(directions)
        normalized_directions[mask.squeeze()] = directions[mask.squeeze()] / distances[mask]
        
        desired_velocities = self.desired_speed * normalized_directions
        return (1/self.relaxation_time) * (desired_velocities - velocities)
    
    def _calculate_agent_repulsion(self, positions, velocities):
        """Calculate repulsive forces between agents."""
        n_agents = positions.shape[0]
        all_forces = torch.zeros((n_agents, 2), device=self.device)
        
        for i in range(n_agents):
            rel_positions = positions - positions[i]
            distances = torch.norm(rel_positions, dim=1)
            # Exclude self-interaction
            mask = (distances > 0) & (distances < 2.0)
            
            if mask.sum() > 0:
                # Unit vectors pointing away from agent i
                direction = rel_positions[mask] / distances[mask].unsqueeze(1)
                # Force magnitude decreases with distance
                magnitude = torch.exp(-distances[mask] / 0.8) * 2.0
                force = direction * magnitude.unsqueeze(1)
                all_forces[i] = -torch.sum(force, dim=0)
        
        return all_forces * self.panic_factor  # Apply panic factor
        
    def _calculate_wall_repulsion(self, positions, walls):
        """Calculate repulsive forces from walls."""
        n_agents = positions.shape[0]
        all_forces = torch.zeros((n_agents, 2), device=self.device)
        
        for wall in walls:
            # Wall is defined by two points (x1,y1) and (x2,y2)
            start, end = torch.tensor(wall[0], device=self.device), torch.tensor(wall[1], device=self.device)
            
            wall_vector = end - start
            wall_length = torch.norm(wall_vector)
            wall_unit = wall_vector / wall_length
            
            # Calculate perpendicular distance to wall for each agent
            for i in range(n_agents):
                agent_pos = positions[i]
                agent_to_start = agent_pos - start
                
                # Project agent position onto wall line
                proj_length = torch.dot(agent_to_start, wall_unit)
                
                # Clamp projection to wall segment
                proj_length = torch.clamp(proj_length, 0, wall_length)
                
                # Closest point on wall to agent
                closest_point = start + proj_length * wall_unit
                
                # Distance and direction from wall to agent
                direction = agent_pos - closest_point
                distance = torch.norm(direction)
                
                if distance < 1.0:  # Only consider walls within 1 meter
                    # Normalize direction and calculate force (stronger when closer)
                    norm_direction = direction / (distance + 1e-6)
                    force_magnitude = torch.exp(-distance / 0.2) * 3.0
                    all_forces[i] += norm_direction * force_magnitude
        
        return all_forces
        
    def _calculate_hazard_avoidance(self, positions, hazards):
        """Calculate forces to avoid hazards (fire, water, etc.)."""
        n_agents = positions.shape[0]
        all_forces = torch.zeros((n_agents, 2), device=self.device)
        
        for hazard in hazards:
            hazard_pos = torch.tensor(hazard['position'], device=self.device)
            hazard_radius = hazard.get('radius', 2.0)
            hazard_intensity = hazard.get('intensity', 1.0)
            
            # Vector from hazard to each agent
            rel_positions = positions - hazard_pos
            distances = torch.norm(rel_positions, dim=1)
            
            # Only affect agents within hazard radius * safety factor
            safety_factor = 2.0
            mask = distances < hazard_radius * safety_factor
            
            if mask.sum() > 0:
                # Direction away from hazard
                direction = rel_positions[mask] / distances[mask].unsqueeze(1)
                # Force increases as agents get closer to hazard
                magnitude = hazard_intensity * torch.exp(-(distances[mask] / hazard_radius)) * 5.0
                force = direction * magnitude.unsqueeze(1)
                all_forces[mask] += force
        
        return all_forces * self.panic_factor  # Panic affects hazard avoidance
    
    def simulate(self, num_agents=100, time_steps=100, building_layout=None, hazards=None, panic_factor=None):
        """
        Run a microscopic simulation using the Social Force Model.
        
        Args:
            num_agents: Number of agents in the simulation
            time_steps: Number of simulation steps
            building_layout: Dict with walls and exits
            hazards: List of hazard locations and properties
            panic_factor: Override default panic factor
        
        Returns:
            Dict containing simulation results
        """
        if panic_factor is not None:
            self.panic_factor = panic_factor
        
        # Use mock mode for quick testing
        if os.environ.get('DEV_MODE') == 'mock':
            logger.info("Using mock microscopic simulation results")
            return self._generate_mock_results(num_agents, time_steps, building_layout, hazards)
        
        # Set up walls from building layout
        walls = building_layout.get('walls', [])
        exits = building_layout.get('exits', [])
        
        # Initialize agents
        positions = torch.rand(num_agents, 2, device=self.device) * 20  # Random positions in 20x20 space
        velocities = torch.zeros(num_agents, 2, device=self.device)
        
        # Assign goals (nearest exit for each agent)
        goals = torch.tensor(exits, device=self.device)
        agent_goals = torch.zeros(num_agents, 2, device=self.device)
        
        for i in range(num_agents):
            distances = torch.norm(goals - positions[i].unsqueeze(0), dim=1)
            closest_exit = torch.argmin(distances)
            agent_goals[i] = goals[closest_exit]
        
        # Setup tracking of agent positions over time
        position_history = torch.zeros(time_steps, num_agents, 2, device=self.device)
        velocity_history = torch.zeros(time_steps, num_agents, 2, device=self.device)
        safe_agents = torch.zeros(time_steps, dtype=torch.int, device=self.device)
        
        # Time step (seconds)
        dt = 0.1
        
        # Main simulation loop
        for t in range(time_steps):
            # Calculate forces
            desired_force = self._calculate_desired_force(positions, velocities, agent_goals)
            agent_repulsion = self._calculate_agent_repulsion(positions, velocities)
            wall_repulsion = self._calculate_wall_repulsion(positions, walls)
            hazard_avoidance = self._calculate_hazard_avoidance(positions, hazards or [])
            
            # Total force
            total_force = desired_force + agent_repulsion + wall_repulsion + hazard_avoidance
            
            # Update velocities (F = ma, assuming unit mass)
            velocities += total_force * dt
            
            # Limit maximum velocity based on panic factor
            max_speed = self.desired_speed * (1 + 0.5 * self.panic_factor)
            speeds = torch.norm(velocities, dim=1, keepdim=True)
            mask = speeds > max_speed
            velocities[mask.squeeze()] = velocities[mask.squeeze()] * max_speed / speeds[mask]
            
            # Update positions
            positions += velocities * dt
            
            # Record positions and velocities
            position_history[t] = positions
            velocity_history[t] = velocities
            
            # Check for agents who reached exits
            for i, exit_pos in enumerate(exits):
                exit_pos_tensor = torch.tensor(exit_pos, device=self.device)
                distances = torch.norm(positions - exit_pos_tensor, dim=1)
                reached_exit = distances < 1.0  # Within 1m of exit
                safe_agents[t] += reached_exit.sum().item()
                
                # Remove agents who reached exits
                if reached_exit.any():
                    # Move them far away and zero their velocity
                    positions[reached_exit] = torch.tensor([-1000, -1000], device=self.device)
                    velocities[reached_exit] = 0
        
        # Convert results to CPU and numpy for serialization
        results = {
            'positions': position_history.cpu().numpy(),
            'velocities': velocity_history.cpu().numpy(),
            'safe_agents': safe_agents.cpu().numpy(),
            'panic_factor': self.panic_factor,
            'time_steps': time_steps,
            'dt': dt
        }
        
        return results
    
    def _generate_mock_results(self, num_agents, time_steps, building_layout, hazards):
        """Generate mock simulation results for quick testing."""
        logger.info(f"Generating mock results for {num_agents} agents over {time_steps} time steps")
        
        # Generate random agent positions (20x20 grid)
        positions = np.random.rand(time_steps, num_agents, 2) * 20
        velocities = np.zeros((time_steps, num_agents, 2))
        safe_agents = np.zeros(time_steps, dtype=int)
        
        # Get exits from building layout
        exits = building_layout.get('exits', [[10, 10]])
        
        # Set velocities pointing toward exits and handle evacuation dynamics
        for t in range(time_steps):
            # More agents evacuate over time
            evacuation_rate = t / time_steps
            safe_agents[t] = int(num_agents * (evacuation_rate ** 2) * 0.9)  # Quadratic evacuation curve
            
            # Agents move toward exits
            for i in range(num_agents):
                # Find closest exit
                closest_exit = exits[0]
                min_dist = float('inf')
                for exit_pos in exits:
                    dist = np.sqrt((positions[t,i,0] - exit_pos[0])**2 + (positions[t,i,1] - exit_pos[1])**2)
                    if dist < min_dist:
                        min_dist = dist
                        closest_exit = exit_pos
                
                # Direction toward exit
                dx = closest_exit[0] - positions[t,i,0]
                dy = closest_exit[1] - positions[t,i,1]
                dist = max(0.1, np.sqrt(dx*dx + dy*dy))
                velocities[t,i,0] = dx / dist * self.desired_speed
                velocities[t,i,1] = dy / dist * self.desired_speed
                
                # For next time step (if not the last)
                if t < time_steps-1:
                    if safe_agents[t] > i:  # This agent has been evacuated
                        positions[t+1,i] = np.array([-1000, -1000])  # Move far away
                        velocities[t+1,i] = np.array([0, 0])  # No velocity
                    else:
                        # Simple movement for next time step
                        positions[t+1,i] = positions[t,i] + velocities[t,i] * 0.1  # dt = 0.1s
        
        # Return results in expected format
        return {
            'positions': positions.tolist(),
            'velocities': velocities.tolist(),
            'safe_agents': safe_agents.tolist(),
            'panic_factor': self.panic_factor,
            'time_steps': time_steps,
            'dt': 0.1,
            'mock_data': True
        }
