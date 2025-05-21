import numpy as np
import torch
import os
import logging

logger = logging.getLogger(__name__)

class BoltzmannModel:
    """
    Mesoscopic evacuation model using Boltzmann approach.
    Models crowd as a continuous density field with flow equations.
    """
    
    def __init__(self, use_gpu=True):
        self.device = torch.device("cuda" if torch.cuda.is_available() and use_gpu else "cpu")
        self.diffusion_coefficient = 0.8
        self.density_threshold = 4.0  # People per square meter
        self.interaction_strength = 1.5
        
    def _initialize_distribution(self, grid_size, building_layout):
        """Initialize distribution function f(x,v,t) on the grid."""
        # Initial spatial density distribution
        density = torch.zeros((grid_size, grid_size), device=self.device)
        
        # Set initial agents in specified areas or default to center
        initial_positions = building_layout.get('initial_positions', [])
        
        if initial_positions:
            for pos in initial_positions:
                x, y, count = pos.get('x', 0), pos.get('y', 0), pos.get('count', 10)
                x_idx = min(max(int(x * grid_size / 20), 0), grid_size-1)
                y_idx = min(max(int(y * grid_size / 20), 0), grid_size-1)
                density[y_idx, x_idx] += count
        else:
            # Default: place people in center
            center = grid_size // 2
            radius = grid_size // 8
            for i in range(center-radius, center+radius):
                for j in range(center-radius, center+radius):
                    if 0 <= i < grid_size and 0 <= j < grid_size:
                        density[i, j] = 5.0  # Initial density
        
        # Velocity distribution - 8 possible directions
        num_velocities = 8
        velocities = torch.zeros((num_velocities, 2), device=self.device)
        
        # Set up velocity directions (8 compass directions)
        for i in range(num_velocities):
            angle = 2 * np.pi * i / num_velocities
            velocities[i, 0] = np.cos(angle)
            velocities[i, 1] = np.sin(angle)
            
        # Full distribution function
        f = torch.zeros((num_velocities, grid_size, grid_size), device=self.device)
        
        # Initially uniform velocity distribution
        for i in range(num_velocities):
            f[i] = density / num_velocities
            
        return f, velocities
        
    def _apply_boundary_conditions(self, f, building_layout, grid_size):
        """Apply no-flux boundary conditions at walls."""
        walls = building_layout.get('walls', [])
        
        # Convert wall coordinates to grid indices
        wall_cells = []
        for wall in walls:
            start, end = wall[0], wall[1]
            # Convert to grid coordinates
            start_x, start_y = int(start[0] * grid_size / 20), int(start[1] * grid_size / 20)
            end_x, end_y = int(end[0] * grid_size / 20), int(end[1] * grid_size / 20)
            
            # Generate all wall cells using Bresenham's line algorithm
            dx = abs(end_x - start_x)
            dy = abs(end_y - start_y)
            sx = 1 if start_x < end_x else -1
            sy = 1 if start_y < end_y else -1
            err = dx - dy
            
            x, y = start_x, start_y
            while not (x == end_x and y == end_y):
                if 0 <= x < grid_size and 0 <= y < grid_size:
                    wall_cells.append((x, y))
                e2 = 2 * err
                if e2 > -dy:
                    err -= dy
                    x += sx
                if e2 < dx:
                    err += dx
                    y += sy
            
            if 0 <= end_x < grid_size and 0 <= end_y < grid_size:
                wall_cells.append((end_x, end_y))
        
        # Apply no-flux condition at walls
        for x, y in wall_cells:
            f[:, y, x] = 0  # Zero distribution at walls
            
        return f
    
    def _compute_macroscopic_fields(self, f):
        """Compute macroscopic density and momentum from distribution function."""
        # Sum over all velocities to get density
        density = torch.sum(f, dim=0)
        
        # Calculate momentum in x and y directions
        momentum_x = torch.sum(f * self.velocities[:, 0].view(-1, 1, 1), dim=0)
        momentum_y = torch.sum(f * self.velocities[:, 1].view(-1, 1, 1), dim=0)
        
        # Calculate velocity field (handle zero density)
        velocity_x = torch.zeros_like(density)
        velocity_y = torch.zeros_like(density)
        
        mask = density > 1e-5
        velocity_x[mask] = momentum_x[mask] / density[mask]
        velocity_y[mask] = momentum_y[mask] / density[mask]
        
        return density, velocity_x, velocity_y
    
    def _collision_step(self, f, density):
        """Model interactions between agents (collision term in Boltzmann equation)."""
        num_velocities = f.shape[0]
        grid_size = f.shape[1]
        
        # Compute equilibrium distribution (where system would relax to)
        f_eq = torch.zeros_like(f)
        
        # Simplified BGK collision operator
        # Relaxation towards local equilibrium
        relaxation_time = torch.ones_like(density)
        
        # Density-dependent relaxation (slower in crowded areas)
        mask = density > self.density_threshold
        relaxation_time[mask] = 2.0  # Slower relaxation in high density
        
        # Calculate equilibrium distribution for each direction
        for i in range(num_velocities):
            # Assuming equal probability of each direction in equilibrium
            f_eq[i] = density / num_velocities
            
        # Update f through collision term
        # df/dt = -(f - f_eq)/tau
        collision_term = -(f - f_eq) / relaxation_time.unsqueeze(0)
        
        return collision_term
        
    def _streaming_step(self, f, dt):
        """Move distribution according to velocity (streaming term)."""
        num_velocities = f.shape[0]
        grid_size = f.shape[1]
        new_f = torch.zeros_like(f)
        
        for i in range(num_velocities):
            vx, vy = self.velocities[i]
            
            # Scale velocities by time step
            shift_x = int(round(vx * dt))
            shift_y = int(round(vy * dt))
            
            # Streaming step (shift distribution in velocity direction)
            for y in range(grid_size):
                for x in range(grid_size):
                    new_x = x + shift_x
                    new_y = y + shift_y
                    
                    # Check bounds
                    if 0 <= new_x < grid_size and 0 <= new_y < grid_size:
                        new_f[i, new_y, new_x] += f[i, y, x]
                    # Otherwise, particles are lost (exit or boundary)
                    
        return new_f
    
    def _add_hazard_influence(self, f, hazards, grid_size, dt):
        """Add influence of hazards on the distribution function."""
        if not hazards:
            return f
        
        # Create hazard field
        hazard_field = torch.zeros((grid_size, grid_size), device=self.device)
        
        # Fill in hazard field
        for hazard in hazards:
            pos_x, pos_y = hazard['position']
            radius = hazard.get('radius', 2.0)
            intensity = hazard.get('intensity', 1.0)
            
            # Convert to grid coordinates
            center_x = int(pos_x * grid_size / 20)
            center_y = int(pos_y * grid_size / 20)
            grid_radius = int(radius * grid_size / 20)
            
            # Add hazard influence
            for y in range(grid_size):
                for x in range(grid_size):
                    dist_sq = (x - center_x)**2 + (y - center_y)**2
                    if dist_sq < grid_radius**2:
                        # Hazard intensity decreases with distance
                        hazard_field[y, x] += intensity * (1.0 - np.sqrt(dist_sq) / grid_radius)
        
        # Calculate repulsion from hazards
        # Particles move away from hazards
        num_velocities = f.shape[0]
        density = torch.sum(f, dim=0)
        
        # For each cell with hazard influence
        mask = hazard_field > 0.01
        if mask.sum() > 0:
            hazard_grad_y, hazard_grad_x = torch.gradient(hazard_field)
            
            # Redistribute particles to move away from hazard
            for i in range(num_velocities):
                vx, vy = self.velocities[i]
                # Dot product of velocity with hazard gradient
                # Positive dot product means velocity away from hazard
                dot_product = -vx * hazard_grad_x - vy * hazard_grad_y
                
                # Increase probability in directions away from hazard
                adjustment = torch.zeros_like(f[i])
                adjustment[mask] = torch.clamp(dot_product[mask] * hazard_field[mask] * dt, 0, density[mask])
                f[i] += adjustment
        
        return f
    
    def _calculate_exit_attraction(self, f, exits, grid_size):
        """Calculate attraction forces toward exits."""
        if not exits:
            return f
        
        # Create potential field from exits
        exit_potential = torch.zeros((grid_size, grid_size), device=self.device)
        
        # Fill in exit potential field
        for exit_pos in exits:
            # Convert to grid coordinates
            exit_x = int(exit_pos[0] * grid_size / 20)
            exit_y = int(exit_pos[1] * grid_size / 20)
            
            # Create distance field from this exit
            for y in range(grid_size):
                for x in range(grid_size):
                    dist = np.sqrt((x - exit_x)**2 + (y - exit_y)**2)
                    # Attraction increases as agents get closer to exit
                    attraction = np.exp(-dist / (grid_size/10))
                    exit_potential[y, x] = max(exit_potential[y, x], attraction)
        
        # Calculate gradients of exit potential
        exit_grad_y, exit_grad_x = torch.gradient(exit_potential)
        
        # Adjust distribution to move toward exits
        num_velocities = f.shape[0]
        density = torch.sum(f, dim=0)
        
        for i in range(num_velocities):
            vx, vy = self.velocities[i]
            # Dot product of velocity with exit gradient
            # Positive dot product means velocity toward exit
            dot_product = vx * exit_grad_x + vy * exit_grad_y
            
            # Increase probability in directions toward exit
            mask = dot_product > 0
            adjustment = torch.zeros_like(f[i])
            adjustment[mask] = dot_product[mask] * 0.1
            
            # Normalize to maintain density
            f[i] += adjustment
            
        return f
    
    def simulate(self, grid_size=50, time_steps=100, building_layout=None, hazards=None):
        """
        Run a mesoscopic simulation.
        
        Args:
            grid_size: Size of the simulation grid
            time_steps: Number of simulation steps
            building_layout: Dict with walls and exits
            hazards: List of hazard locations and properties
        
        Returns:
            Dict containing simulation results
        """
        # Use mock mode for quick testing
        if os.environ.get('DEV_MODE') == 'mock':
            logger.info("Using mock mesoscopic simulation results")
            return self._generate_mock_results(grid_size, time_steps, building_layout, hazards)
        
        dt = 0.1  # Time step
        
        # Setup
        self.velocities = torch.zeros((8, 2), device=self.device)
        for i in range(8):
            angle = 2 * np.pi * i / 8
            self.velocities[i, 0] = np.cos(angle)
            self.velocities[i, 1] = np.sin(angle)
            
        # Initialize distribution function
        f, _ = self._initialize_distribution(grid_size, building_layout or {})
        
        # Extract exits from layout
        exits = building_layout.get('exits', [])
        
        # Setup tracking of density and flow over time
        density_history = torch.zeros(time_steps, grid_size, grid_size, device=self.device)
        velocity_x_history = torch.zeros(time_steps, grid_size, grid_size, device=self.device)
        velocity_y_history = torch.zeros(time_steps, grid_size, grid_size, device=self.device)
        total_occupancy = torch.zeros(time_steps, device=self.device)
        
        # Apply boundary conditions (walls)
        f = self._apply_boundary_conditions(f, building_layout or {}, grid_size)
        
        # Main simulation loop
        for t in range(time_steps):
            # Calculate macroscopic fields
            density, velocity_x, velocity_y = self._compute_macroscopic_fields(f)
            
            # Store current state
            density_history[t] = density
            velocity_x_history[t] = velocity_x
            velocity_y_history[t] = velocity_y
            total_occupancy[t] = torch.sum(density)
            
            # Calculate collision term
            collision_term = self._collision_step(f, density)
            
            # Update distribution with collision effects
            f = f + dt * collision_term
            
            # Add hazard influence
            f = self._add_hazard_influence(f, hazards or [], grid_size, dt)
            
            # Add exit attraction
            f = self._calculate_exit_attraction(f, exits, grid_size)
            
            # Streaming step
            f = self._streaming_step(f, dt)
            
            # Apply boundary conditions again
            f = self._apply_boundary_conditions(f, building_layout or {}, grid_size)
        
        # Convert results to CPU and numpy for serialization
        results = {
            'density': density_history.cpu().numpy(),
            'velocity_x': velocity_x_history.cpu().numpy(),
            'velocity_y': velocity_y_history.cpu().numpy(),
            'total_occupancy': total_occupancy.cpu().numpy(),
            'grid_size': grid_size,
            'time_steps': time_steps,
            'dt': dt
        }
        
        return results
    
    def _generate_mock_results(self, grid_size, time_steps, building_layout, hazards):
        """Generate mock simulation results for quick testing."""
        # Generate density field that decreases over time
        density = np.zeros((time_steps, grid_size, grid_size))
        velocity_x = np.zeros((time_steps, grid_size, grid_size))
        velocity_y = np.zeros((time_steps, grid_size, grid_size))
        total_occupancy = np.zeros(time_steps)
        
        # Get exits from building layout for velocity field calculation
        exits = building_layout.get('exits', [[10, 10]])
        exit_positions = []
        for exit_pos in exits:
            # Convert to grid coordinates
            ex = int(exit_pos[0] * grid_size / 20)
            ey = int(exit_pos[1] * grid_size / 20)
            if 0 <= ex < grid_size and 0 <= ey < grid_size:
                exit_positions.append((ex, ey))
        
        if not exit_positions:
            exit_positions = [(grid_size//2, grid_size//2)]
        
        # Initial density concentration in center
        center = grid_size // 2
        radius = grid_size // 4
        for i in range(grid_size):
            for j in range(grid_size):
                dist = np.sqrt((i - center)**2 + (j - center)**2)
                if dist < radius:
                    density[0, i, j] = 1.0 * (1 - dist/radius)
        
        total_occupancy[0] = np.sum(density[0])
        
        # Evolve density over time (flowing toward exits)
        for t in range(1, time_steps):
            # Density decreases over time (evacuation)
            decay_factor = 1.0 - (t / time_steps) * 0.8
            density[t] = density[t-1] * decay_factor
            
            # Calculate velocity field (pointing toward exits)
            for i in range(grid_size):
                for j in range(grid_size):
                    if density[t, i, j] > 0.01:  # Only for occupied cells
                        # Find closest exit
                        closest_exit = exit_positions[0]
                        min_dist = float('inf')
                        for ex, ey in exit_positions:
                            dist = np.sqrt((i - ex)**2 + (j - ey)**2)
                            if dist < min_dist:
                                min_dist = dist
                                closest_exit = (ex, ey)
                        
                        # Direction toward exit
                        ex, ey = closest_exit
                        dx = ex - i
                        dy = ey - j
                        dist = max(0.1, np.sqrt(dx*dx + dy*dy))
                        velocity_x[t, i, j] = dx / dist
                        velocity_y[t, i, j] = dy / dist
            
            # Track total occupancy
            total_occupancy[t] = np.sum(density[t])
        
        return {
            'density': density.tolist(),
            'velocity_x': velocity_x.tolist(),
            'velocity_y': velocity_y.tolist(),
            'total_occupancy': total_occupancy.tolist(),
            'grid_size': grid_size,
            'time_steps': time_steps,
            'mock_data': True
        }
