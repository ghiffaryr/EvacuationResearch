import numpy as np
import torch
import torch.nn as nn
import logging
import os

logger = logging.getLogger(__name__)

class MacroscopicModel:
    """
    Macroscopic evacuation model using PDEs with hazard coupling.
    Uses a combination of numerical PDE solvers and physics-informed neural networks.
    """
    
    def __init__(self, use_gpu=True):
        self.device = torch.device("cuda" if torch.cuda.is_available() and use_gpu else "cpu")
        self.diffusion_coefficient = 0.5  # D in PDE
        self.evacuation_coefficient = 1.5  # γ parameter for evacuation term
        self.fire_coupling = 0.2  # Coupling strength with fire model
        self.structural_coupling = 0.3  # Coupling strength with structural damage
        
        # Don't initialize PINN by default - it's not used in mock mode
        self.pinn = None
        
    def _init_pinn(self):
        """Initialize the Physics-Informed Neural Network for PDE surrogate - only when needed."""
        if self.pinn is not None:
            return  # Already initialized
            
        logger.info("Initializing PINN model for macroscopic simulation")
        
        # PINN architecture
        self.pinn = nn.Sequential(
            nn.Linear(3, 64),  # Input: x, y, t
            nn.Tanh(),
            nn.Linear(64, 128),
            nn.Tanh(),
            nn.Linear(128, 64),  # Simplified architecture
            nn.Tanh(),
            nn.Linear(64, 1),  # Output: density
        ).to(self.device)
        
        # Optimizer
        self.optimizer = torch.optim.Adam(self.pinn.parameters(), lr=0.001)
        
    def _solve_pde_finite_difference(self, grid_resolution, time_steps, building_layout, hazards):
        """Solve macroscopic PDE using finite differences."""
        dx = 1.0 / grid_resolution  # Spatial step size
        dt = 0.1  # Time step
        
        # Initialize density field
        density = torch.zeros((grid_resolution, grid_resolution), device=self.device)
        initial_positions = building_layout.get('initial_positions', [])
        
        if initial_positions:
            for pos in initial_positions:
                x, y, count = pos.get('x', 0), pos.get('y', 0), pos.get('count', 100)
                x_idx = min(max(int(x * grid_resolution / 20), 0), grid_resolution-1)
                y_idx = min(max(int(y * grid_resolution / 20), 0), grid_resolution-1)
                density[y_idx, x_idx] = count / (dx*dx)  # Convert count to density
        else:
            # Default: initialize in center
            center = grid_resolution // 2
            radius = grid_resolution // 8
            for i in range(center-radius, center+radius):
                for j in range(center-radius, center+radius):
                    if 0 <= i < grid_resolution and 0 <= j < grid_resolution:
                        density[i, j] = 5.0 / (dx*dx)  # Initial density
        
        # Initialize hazard fields
        fire_field = torch.zeros((grid_resolution, grid_resolution), device=self.device)
        structural_damage = torch.zeros((grid_resolution, grid_resolution), device=self.device)
        
        # Set up hazards
        for hazard in hazards:
            pos_x, pos_y = hazard['position']
            radius = hazard.get('radius', 2.0)
            intensity = hazard.get('intensity', 1.0)
            hazard_type = hazard.get('type', 'fire')
            
            # Convert to grid indices
            center_x = int(pos_x * grid_resolution / 20)
            center_y = int(pos_y * grid_resolution / 20)
            grid_radius = int(radius * grid_resolution / 20)
            
            # Add hazard to appropriate field
            for y in range(grid_resolution):
                for x in range(grid_resolution):
                    dist_sq = (x - center_x)**2 + (y - center_y)**2
                    if dist_sq < grid_radius**2:
                        if hazard_type == 'fire':
                            fire_field[y, x] = intensity * (1 - np.sqrt(dist_sq) / grid_radius)
                        elif hazard_type == 'structural':
                            structural_damage[y, x] = intensity * (1 - np.sqrt(dist_sq) / grid_radius)
        
        # Extract walls and exits
        walls = building_layout.get('walls', [])
        exits = building_layout.get('exits', [])
        
        # Convert walls to grid representation
        wall_mask = torch.zeros((grid_resolution, grid_resolution), dtype=torch.bool, device=self.device)
        for wall in walls:
            start, end = wall[0], wall[1]
            # Convert to grid indices
            start_x = int(start[0] * grid_resolution / 20)
            start_y = int(start[1] * grid_resolution / 20)
            end_x = int(end[0] * grid_resolution / 20)
            end_y = int(end[1] * grid_resolution / 20)
            
            # Use Bresenham's algorithm to draw the wall
            dx = abs(end_x - start_x)
            dy = abs(end_y - start_y)
            sx = 1 if start_x < end_x else -1
            sy = 1 if start_y < end_y else -1
            err = dx - dy
            
            x, y = start_x, start_y
            while not (x == end_x and y == end_y):
                if 0 <= x < grid_resolution and 0 <= y < grid_resolution:
                    wall_mask[y, x] = True
                e2 = 2 * err
                if e2 > -dy:
                    err -= dy
                    x += sx
                if e2 < dx:
                    err += dx
                    y += sy
            
            if 0 <= end_x < grid_resolution and 0 <= end_y < grid_resolution:
                wall_mask[end_y, end_x] = True
        
        # Create exit field for attraction
        exit_field = torch.zeros((grid_resolution, grid_resolution), device=self.device)
        for exit_pos in exits:
            # Convert to grid indices
            exit_x = int(exit_pos[0] * grid_resolution / 20)
            exit_y = int(exit_pos[1] * grid_resolution / 20)
            
            # Set strong exit attraction in small area
            exit_radius = max(1, int(0.5 * grid_resolution / 20))
            for y in range(grid_resolution):
                for x in range(grid_resolution):
                    dist = np.sqrt((x - exit_x)**2 + (y - exit_y)**2)
                    if dist < exit_radius:
                        exit_field[y, x] = 1.0
        
        # Initialize solution arrays
        density_history = torch.zeros(time_steps, grid_resolution, grid_resolution, device=self.device)
        velocity_x_history = torch.zeros(time_steps, grid_resolution, grid_resolution, device=self.device)
        velocity_y_history = torch.zeros(time_steps, grid_resolution, grid_resolution, device=self.device)
        fire_history = torch.zeros(time_steps, grid_resolution, grid_resolution, device=self.device)
        evacuated_count = torch.zeros(time_steps, device=self.device)
        
        # Create velocity field from exit potential
        def update_velocity_field():
            # Use distance to nearest exit to create potential
            potential = torch.zeros((grid_resolution, grid_resolution), device=self.device) + 1000.0
            
            # For each exit, calculate distance field
            for exit_pos in exits:
                exit_x = int(exit_pos[0] * grid_resolution / 20)
                exit_y = int(exit_pos[1] * grid_resolution / 20)
                
                for y in range(grid_resolution):
                    for x in range(grid_resolution):
                        if not wall_mask[y, x]:  # Skip walls
                            dist = np.sqrt((x - exit_x)**2 + (y - exit_y)**2)
                            potential[y, x] = min(potential[y, x], dist)
            
            # Calculate potential gradient
            grad_y, grad_x = torch.gradient(potential)
            
            # Normalize gradient to create unit vector field
            velocity_x = torch.zeros_like(grad_x)
            velocity_y = torch.zeros_like(grad_y)
            
            mag = torch.sqrt(grad_x**2 + grad_y**2)
            mask = mag > 0
            velocity_x[mask] = -grad_x[mask] / mag[mask]  # Negative gradient points toward exits
            velocity_y[mask] = -grad_y[mask] / mag[mask]
            
            # Zero velocity at walls
            velocity_x[wall_mask] = 0
            velocity_y[wall_mask] = 0
            
            return velocity_x, velocity_y
        
        # Calculate initial velocity field
        velocity_x, velocity_y = update_velocity_field()
        
        # Main simulation loop
        for t in range(time_steps):
            # Store current state
            density_history[t] = density
            velocity_x_history[t] = velocity_x
            velocity_y_history[t] = velocity_y
            fire_history[t] = fire_field
            
            # Update fire field (simple model: fire spreads to neighbors)
            if torch.sum(fire_field) > 0:
                fire_spread = torch.zeros_like(fire_field)
                # Use 2D convolution for diffusion
                fire_spread = torch.nn.functional.conv2d(
                    fire_field.unsqueeze(0).unsqueeze(0),
                    torch.tensor([[0.05, 0.2, 0.05], 
                                  [0.2, 0.0, 0.2], 
                                  [0.05, 0.2, 0.05]], device=self.device).unsqueeze(0).unsqueeze(0),
                    padding=1
                ).squeeze()
                fire_field = torch.clamp(fire_field + 0.1 * fire_spread, 0, 1.0)
                
                # Fire doesn't spread through walls
                fire_field[wall_mask] = 0
            
            # Calculate density flux
            flux_x = velocity_x * density
            flux_y = velocity_y * density
            
            # Divergence of flux
            div_x = torch.zeros_like(flux_x)
            div_y = torch.zeros_like(flux_y)
            
            div_x[1:-1, 1:-1] = (flux_x[1:-1, 2:] - flux_x[1:-1, :-2]) / (2 * dx)
            div_y[1:-1, 1:-1] = (flux_y[2:, 1:-1] - flux_y[:-2, 1:-1]) / (2 * dx)
            
            # Diffusion term (Laplacian)
            laplacian = torch.zeros_like(density)
            laplacian[1:-1, 1:-1] = (
                density[1:-1, 2:] + density[1:-1, :-2] + 
                density[2:, 1:-1] + density[:-2, 1:-1] - 
                4 * density[1:-1, 1:-1]
            ) / (dx * dx)
            
            # Evacuation term (density decreases at exits)
            evacuation = self.evacuation_coefficient * exit_field * density
            
            # Hazard avoidance (density decreases in fire areas)
            hazard_effect = self.fire_coupling * fire_field * density
            
            # Update density using the full PDE
            density_new = density - dt * (div_x + div_y) + dt * self.diffusion_coefficient * laplacian - dt * evacuation - dt * hazard_effect
            
            # No negative density
            density_new = torch.clamp(density_new, min=0.0)
            
            # No density at walls
            density_new[wall_mask] = 0
            
            # Track evacuated people (disappeared at exits)
            evacuated_count[t] = torch.sum(dt * evacuation)
            
            # Update for next iteration
            density = density_new
            
            # Recalculate velocity field occasionally
            if t % 10 == 0:
                velocity_x, velocity_y = update_velocity_field()
                
                # Modify velocity field to avoid fire
                if torch.sum(fire_field) > 0:
                    # Calculate gradient of fire field
                    fire_grad_y, fire_grad_x = torch.gradient(fire_field)
                    
                    # Add avoidance component to velocity field
                    fire_magnitude = torch.sqrt(fire_grad_x**2 + fire_grad_y**2)
                    mask = fire_magnitude > 0
                    
                    if mask.any():
                        avoidance_x = fire_grad_x.clone()
                        avoidance_y = fire_grad_y.clone()
                        avoidance_x[mask] = avoidance_x[mask] / fire_magnitude[mask]
                        avoidance_y[mask] = avoidance_y[mask] / fire_magnitude[mask]
                        
                        # Scale by fire intensity
                        avoidance_x *= fire_field
                        avoidance_y *= fire_field
                        
                        # Add to velocity field
                        velocity_x = velocity_x - 0.5 * avoidance_x
                        velocity_y = velocity_y - 0.5 * avoidance_y
                        
                        # Renormalize
                        mag = torch.sqrt(velocity_x**2 + velocity_y**2)
                        mask = mag > 0
                        velocity_x[mask] = velocity_x[mask] / mag[mask]
                        velocity_y[mask] = velocity_y[mask] / mag[mask]
        
        # Convert results to CPU and numpy for serialization
        results = {
            'density': density_history.cpu().numpy(),
            'velocity_x': velocity_x_history.cpu().numpy(),
            'velocity_y': velocity_y_history.cpu().numpy(),
            'fire': fire_history.cpu().numpy(),
            'evacuated_count': evacuated_count.cpu().numpy(),
            'grid_resolution': grid_resolution,
            'time_steps': time_steps,
            'dt': dt
        }
        
        return results
    
    def _train_pinn(self, grid_resolution, time_steps, building_layout, hazards):
        """Train Physics-Informed Neural Network as PDE surrogate."""
        # Number of collocation points
        n_points = 10000
        
        # Generate collocation points (x, y, t)
        x = torch.rand(n_points, device=self.device)
        y = torch.rand(n_points, device=self.device)
        t = torch.rand(n_points, device=self.device)
        
        # Pack into input tensor
        X = torch.stack([x, y, t], dim=1).requires_grad_(True)
        
        # Extract building layout and hazard information
        exits = torch.tensor(building_layout.get('exits', []), device=self.device)
        hazard_positions = torch.tensor([h['position'] for h in hazards], device=self.device)
        hazard_intensities = torch.tensor([h.get('intensity', 1.0) for h in hazards], device=self.device)
        
        # Number of training iterations
        n_iterations = 5000
        
        for i in range(n_iterations):
            # Forward pass through the network
            density = self.pinn(X)
            
            # Calculate derivatives using autograd
            density_x = torch.autograd.grad(
                density, X, torch.ones_like(density), create_graph=True
            )[0][:, 0].view(-1, 1)
            
            density_y = torch.autograd.grad(
                density, X, torch.ones_like(density), create_graph=True
            )[0][:, 1].view(-1, 1)
            
            density_t = torch.autograd.grad(
                density, X, torch.ones_like(density), create_graph=True
            )[0][:, 2].view(-1, 1)
            
            # Calculate second derivatives
            density_xx = torch.autograd.grad(
                density_x, X, torch.ones_like(density_x), create_graph=True
            )[0][:, 0].view(-1, 1)
            
            density_yy = torch.autograd.grad(
                density_y, X, torch.ones_like(density_y), create_graph=True
            )[0][:, 1].view(-1, 1)
            
            # Calculate Laplacian
            laplacian = density_xx + density_yy
            
            # Calculate evacuation term (density decreases near exits)
            evacuation_term = torch.zeros((n_points, 1), device=self.device)
            for exit_pos in exits:
                dist_to_exit = torch.sqrt((X[:, 0] - exit_pos[0]/20)**2 + (X[:, 1] - exit_pos[1]/20)**2)
                evacuation_term += torch.exp(-dist_to_exit / 0.1).view(-1, 1) * density
            
            # Calculate hazard term
            hazard_term = torch.zeros((n_points, 1), device=self.device)
            for pos, intensity in zip(hazard_positions, hazard_intensities):
                dist_to_hazard = torch.sqrt((X[:, 0] - pos[0]/20)**2 + (X[:, 1] - pos[1]/20)**2)
                hazard_term += intensity * torch.exp(-dist_to_hazard / 0.1).view(-1, 1) * density
            
            # PDE residual: density_t - D*laplacian + evacuation_term + hazard_term = 0
            residual = density_t - self.diffusion_coefficient * laplacian + self.evacuation_coefficient * evacuation_term + self.fire_coupling * hazard_term
            
            # Loss function
            loss = torch.mean(residual**2)
            
            # Backward and optimize
            self.optimizer.zero_grad()
            loss.backward()
            self.optimizer.step()
            
            if (i+1) % 500 == 0:
                print(f'Iteration {i+1}/{n_iterations}, Loss: {loss.item():.6f}')
        
        print("PINN training completed.")
        
    def simulate(self, grid_resolution=100, time_steps=100, building_layout=None, hazards=None, use_pinn=False):
        """
        Run a macroscopic simulation using PDE models.
        
        Args:
            grid_resolution: Resolution of the simulation grid
            time_steps: Number of simulation time steps
            building_layout: Dict with walls, exits, and initial positions
            hazards: List of hazard locations and properties
            use_pinn: Whether to use Physics-Informed Neural Networks
            
        Returns:
            Dict containing simulation results
        """
        # Check for mock mode first
        if os.environ.get('DEV_MODE') == 'mock':
            logger.info("Using mock data for macroscopic simulation")
            return self._generate_mock_results(grid_resolution, time_steps, building_layout, hazards)
        
        # Only initialize PINN if requested (expensive operation)
        if use_pinn:
            self._init_pinn()
            # Train and use the PINN...
            
        # Use finite difference method by default
        return self._solve_pde_finite_difference(grid_resolution, time_steps, building_layout or {}, hazards or [])
    
    def _generate_mock_results(self, grid_resolution, time_steps, building_layout, hazards):
        """Generate mock simulation results for quick testing."""
        import numpy as np
        from time import time
        
        start_time = time()
        logger.info(f"Generating mock macroscopic results with grid={grid_resolution}, steps={time_steps}")
        
        # Cap resolution to reasonable values
        grid_resolution = min(grid_resolution, 150)
        time_steps = min(time_steps, 120)
        
        # Create arrays with reduced size for efficiency
        density = np.zeros((time_steps, grid_resolution, grid_resolution))
        velocity_x = np.zeros((time_steps, grid_resolution, grid_resolution))
        velocity_y = np.zeros((time_steps, grid_resolution, grid_resolution))
        fire = np.zeros((time_steps, grid_resolution, grid_resolution))
        evacuated_count = np.zeros(time_steps)
        
        # Initial density in center
        center = grid_resolution // 2
        for i in range(grid_resolution):
            for j in range(grid_resolution):
                dist = np.sqrt((i - center)**2 + (j - center)**2)
                if dist < grid_resolution // 4:
                    density[0, i, j] = np.exp(-dist / (grid_resolution / 8))
        
        # Simple fire spread in corner
        fire_x, fire_y = grid_resolution // 5, grid_resolution // 5
        for i in range(grid_resolution):
            for j in range(grid_resolution):
                dist = np.sqrt((i - fire_x)**2 + (j - fire_y)**2)
                if dist < grid_resolution // 10:
                    fire[0, i, j] = np.exp(-dist / (grid_resolution / 15))
        
        # Simple time evolution
        for t in range(1, time_steps):
            # Evacuate people over time
            evac_rate = (t / time_steps) ** 0.8  # Non-linear evacuation curve
            evacuated_count[t] = 500 * evac_rate
            
            # Reduce density according to evacuation
            density[t] = density[0] * (1 - evac_rate)
            
            # Expand fire for first half of simulation
            if t < time_steps // 2:
                fire[t] = np.minimum(fire[t-1] * 1.05, 1.0)
            else:
                fire[t] = fire[t-1]
            
            # Set velocity field (radial from center for simplicity)
            for i in range(grid_resolution):
                for j in range(grid_resolution):
                    dx = i - center
                    dy = j - center
                    dist = max(0.1, np.sqrt(dx*dx + dy*dy))
                    velocity_x[t, i, j] = dx / dist
                    velocity_y[t, i, j] = dy / dist
        
        logger.info(f"Mock data generation completed in {time() - start_time:.2f} seconds")
        
        return {
            'density': density.tolist(),
            'velocity_x': velocity_x.tolist(),
            'velocity_y': velocity_y.tolist(),
            'fire': fire.tolist(),
            'evacuated_count': evacuated_count.tolist(),
            'grid_resolution': grid_resolution,
            'time_steps': time_steps,
            'dt': 0.1,
            'mock_data': True
        }
