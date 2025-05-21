import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
import random
from collections import deque
import os
import logging

logger = logging.getLogger(__name__)

class EvacuationEnvironment:
    """Environment for training RL agents to optimize evacuation plans."""
    
    def __init__(self, grid_size=50, num_agents=100, building_layout=None, hazards=None):
        self.grid_size = grid_size
        self.num_agents = num_agents
        self.building_layout = building_layout or {}
        self.hazards = hazards or []
        
        # Extract layout information
        self.walls = self.building_layout.get('walls', [])
        self.exits = self.building_layout.get('exits', [])
        
        # Create grid representation
        self.grid = np.zeros((self.grid_size, self.grid_size, 3))  # Channels: agents, walls, hazards
        self._build_grid()
        
        # Agent positions and status
        self.agent_positions = []
        self.agent_status = np.zeros(self.num_agents)  # 0 = active, 1 = evacuated
        self._previous_evacuated = 0  # Initialize tracking variable
        self.reset()
        
    def _build_grid(self):
        # Add walls to grid
        for wall in self.walls:
            start, end = wall[0], wall[1]
            # Convert to grid coordinates
            start_x = int(start[0] * self.grid_size / 20)
            start_y = int(start[1] * self.grid_size / 20)
            end_x = int(end[0] * self.grid_size / 20)
            end_y = int(end[1] * self.grid_size / 20)
            
            # Draw line
            self._draw_line(start_x, start_y, end_x, end_y, channel=1)  # Wall channel
        
        # Add hazards to grid
        for hazard in self.hazards:
            pos_x, pos_y = hazard['position']
            radius = hazard.get('radius', 2.0)
            intensity = hazard.get('intensity', 1.0)
            
            # Convert to grid coordinates
            center_x = int(pos_x * self.grid_size / 20)
            center_y = int(pos_y * self.grid_size / 20)
            grid_radius = int(radius * self.grid_size / 20)
            
            # Add circular hazard
            for y in range(self.grid_size):
                for x in range(self.grid_size):
                    dist_sq = (x - center_x)**2 + (y - center_y)**2
                    if dist_sq < grid_radius**2:
                        # Hazard intensity decreases with distance
                        self.grid[y, x, 2] += intensity * (1.0 - np.sqrt(dist_sq) / grid_radius)
        
    def _draw_line(self, x0, y0, x1, y1, channel):
        """Draw a line using Bresenham's algorithm."""
        dx = abs(x1 - x0)
        dy = abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx - dy
        
        while True:
            if 0 <= x0 < self.grid_size and 0 <= y0 < self.grid_size:
                self.grid[y0, x0, channel] = 1.0
                
            if x0 == x1 and y0 == y1:
                break
                
            e2 = 2 * err
            if e2 > -dy:
                err -= dy
                x0 += sx
            if e2 < dx:
                err += dx
                y0 += sy
    
    def reset(self):
        """Reset environment to initial state."""
        # Clear agent channel
        self.grid[:, :, 0] = 0
        
        # Reset agent positions and status
        self.agent_positions = []
        self.agent_status = np.zeros(self.num_agents)
        self._previous_evacuated = 0  # Reset tracking variable
        self.time_step = 0
        
        # Initialize agents at random positions (not on walls or hazards)
        count = 0
        while count < self.num_agents:
            x = np.random.randint(0, self.grid_size)
            y = np.random.randint(0, self.grid_size)
            
            # Check if position is valid (no wall or hazard)
            if self.grid[y, x, 1] == 0 and self.grid[y, x, 2] < 0.5:
                self.agent_positions.append((x, y))
                self.grid[y, x, 0] += 1  # Increment agent count
                count += 1
        
        # Calculate initial state
        state = self._get_state()
        return state
    
    def _get_state(self):
        """Get current state representation for RL algorithm."""
        # Simplified state: normalized grid with agent densities, walls, hazards
        normalized_grid = self.grid.copy()
        
        # Normalize agent channel (max density of 5 agents per cell)
        normalized_grid[:, :, 0] /= 5.0
        normalized_grid[:, :, 0] = np.clip(normalized_grid[:, :, 0], 0, 1)
        
        # State also includes exit locations
        exit_channel = np.zeros((self.grid_size, self.grid_size))
        for exit_pos in self.exits:
            ex, ey = int(exit_pos[0] * self.grid_size / 20), int(exit_pos[1] * self.grid_size / 20)
            if 0 <= ex < self.grid_size and 0 <= ey < self.grid_size:
                exit_channel[ey, ex] = 1.0
        
        # Add exit channel
        state = np.dstack((normalized_grid, exit_channel))
        return state
        
    def step(self, action):
        """Take action and return new state, reward, done."""
        # Action: 0-7 for 8 directions of movement recommendation
        # This represents the "global" direction the system should push agents toward
        
        # Convert action to direction vector
        directions = [
            (0, -1),  # North
            (1, -1),  # Northeast
            (1, 0),   # East
            (1, 1),   # Southeast
            (0, 1),   # South
            (-1, 1),  # Southwest
            (-1, 0),  # West
            (-1, -1)  # Northwest
        ]
        
        dx, dy = directions[action]
        
        # Clear agent channel
        self.grid[:, :, 0] = 0
        
        # Move agents according to the recommended direction
        for i in range(len(self.agent_positions)):
            if self.agent_status[i] == 1:  # Skip evacuated agents
                continue
                
            x, y = self.agent_positions[i]
            
            # Compute forces: desired direction + exit attraction + hazard repulsion
            force_x, force_y = dx, dy
            
            # Add exit attraction
            min_dist = float('inf')
            closest_exit = None
            for exit_pos in self.exits:
                ex, ey = int(exit_pos[0] * self.grid_size / 20), int(exit_pos[1] * self.grid_size / 20)
                dist = np.sqrt((x - ex)**2 + (y - ey)**2)
                if dist < min_dist:
                    min_dist = dist
                    closest_exit = (ex, ey)
            
            if closest_exit:
                ex, ey = closest_exit
                dist = max(min_dist, 0.1)  # Avoid division by zero
                force_x += (ex - x) / (dist * 5)
                force_y += (ey - y) / (dist * 5)
            
            # Add hazard repulsion
            for hazard in self.hazards:
                pos_x, pos_y = hazard['position']
                hx, hy = int(pos_x * self.grid_size / 20), int(pos_y * self.grid_size / 20)
                dist = np.sqrt((x - hx)**2 + (y - hy)**2)
                if dist < hazard.get('radius', 2.0) * self.grid_size / 10:  # Double radius for safety
                    dist = max(dist, 0.1)  # Avoid division by zero
                    force_x -= (hx - x) / (dist * 3)
                    force_y -= (hy - y) / (dist * 3)
            
            # Normalize force vector
            force_mag = np.sqrt(force_x**2 + force_y**2)
            if force_mag > 0:
                force_x /= force_mag
                force_y /= force_mag
            
            # Move agent based on force
            new_x = int(round(x + force_x))
            new_y = int(round(y + force_y))
            
            # Check boundaries
            new_x = max(0, min(new_x, self.grid_size - 1))
            new_y = max(0, min(new_y, self.grid_size - 1))
            
            # Check if new position is valid (no wall)
            if self.grid[new_y, new_x, 1] == 0:
                # Update position
                self.agent_positions[i] = (new_x, new_y)
                
                # Check if reached exit
                for exit_pos in self.exits:
                    ex, ey = int(exit_pos[0] * self.grid_size / 20), int(exit_pos[1] * self.grid_size / 20)
                    if abs(new_x - ex) <= 1 and abs(new_y - ey) <= 1:
                        self.agent_status[i] = 1  # Mark as evacuated
                        break
        
        # Update agent grid
        for i, (x, y) in enumerate(self.agent_positions):
            if self.agent_status[i] == 0:  # Only active agents
                self.grid[y, x, 0] += 1
        
        # Calculate rewards
        evacuated_now = np.sum(self.agent_status) - self._previous_evacuated
        self._previous_evacuated = np.sum(self.agent_status)
        
        # Basic reward: number of newly evacuated agents
        reward = evacuated_now * 10.0
        
        # Penalty for agents in hazardous areas
        hazard_penalty = 0
        for i, (x, y) in enumerate(self.agent_positions):
            if self.agent_status[i] == 0:  # Only active agents
                hazard_penalty += self.grid[y, x, 2]  # Hazard intensity
        
        reward -= hazard_penalty * 2.0
        
        # Fairness-based reward component
        if self.exits and np.sum(self.agent_status) > 0:
            # Count agents evacuated through each exit
            exit_usage = np.zeros(len(self.exits))
            for i, (x, y) in enumerate(self.agent_positions):
                if self.agent_status[i] == 1:  # Evacuated agents
                    # Find closest exit (assumed to be the one used)
                    min_dist = float('inf')
                    used_exit = 0
                    for j, exit_pos in enumerate(self.exits):
                        ex, ey = int(exit_pos[0] * self.grid_size / 20), int(exit_pos[1] * self.grid_size / 20)
                        dist = np.sqrt((x - ex)**2 + (y - ey)**2)
                        if dist < min_dist:
                            min_dist = dist
                            used_exit = j
                    exit_usage[used_exit] += 1
            
            # Calculate Gini coefficient for exit usage
            if np.sum(exit_usage) > 0:
                exit_usage = exit_usage / np.sum(exit_usage)  # Normalize
                gini = self._calculate_gini(exit_usage)
                fairness_reward = max(0, 0.1 - gini) * 5.0  # Reward for gini < 0.1
                reward += fairness_reward
        
        # Check if done
        done = (np.sum(self.agent_status) == self.num_agents) or (self.time_step >= 1000)
        self.time_step += 1
        
        # Get new state
        new_state = self._get_state()
        
        # Info dict
        info = {
            'evacuated': int(np.sum(self.agent_status)),
            'hazard_penalty': hazard_penalty,
            'time_step': self.time_step
        }
        
        return new_state, reward, done, info
    
    def _calculate_gini(self, array):
        """Calculate the Gini coefficient of a numpy array."""
        if np.all(array == 0):
            return 0
        array = np.sort(array)
        index = np.arange(1, array.shape[0] + 1)
        return np.sum((2 * index - array.shape[0] - 1) * array) / (array.shape[0] * np.sum(array))

class PolicyNetwork(nn.Module):
    """Neural network for the RL policy."""
    
    def __init__(self, state_shape, action_size=8):
        super(PolicyNetwork, self).__init__()
        # Convolutional layers to process spatial information
        self.conv1 = nn.Conv2d(state_shape[2], 32, kernel_size=3, stride=1, padding=1)
        self.conv2 = nn.Conv2d(32, 64, kernel_size=3, stride=2, padding=1)
        self.conv3 = nn.Conv2d(64, 64, kernel_size=3, stride=2, padding=1)
        
        # Calculate size after convolutions
        conv_output_size = 64 * (state_shape[0] // 4) * (state_shape[1] // 4)
        
        # Fully connected layers
        self.fc1 = nn.Linear(conv_output_size, 256)
        self.fc2 = nn.Linear(256, action_size)
    
    def forward(self, x):
        # Our state values are already normalized between 0-1 in _get_state()
        # No need for division by 255.0
        
        # Convolutional layers
        x = F.relu(self.conv1(x))
        x = F.relu(self.conv2(x))
        x = F.relu(self.conv3(x))
        
        # Flatten - use reshape instead of view to handle non-contiguous tensors
        x = x.reshape(x.size(0), -1)
        
        # Fully connected layers
        x = F.relu(self.fc1(x))
        x = self.fc2(x)
        
        return x

class RLAgent:
    """Reinforcement learning agent for evacuation optimization."""
    
    def __init__(self, state_shape, action_size=8, use_gpu=True):
        self.device = torch.device("cuda" if torch.cuda.is_available() and use_gpu else "cpu")
        self.state_shape = state_shape
        self.action_size = action_size
        
        # Create policy network
        self.policy_net = PolicyNetwork(state_shape, action_size).to(self.device)
        self.target_net = PolicyNetwork(state_shape, action_size).to(self.device)
        self.target_net.load_state_dict(self.policy_net.state_dict())
        
        self.optimizer = optim.Adam(self.policy_net.parameters(), lr=0.0001)
        self.memory = deque(maxlen=10000)
        self.batch_size = 32
        self.gamma = 0.99  # Discount factor
        self.epsilon = 1.0  # Exploration rate
        self.epsilon_min = 0.1
        self.epsilon_decay = 0.995
        self.update_target_frequency = 10  # Update target network every N episodes
        
    def remember(self, state, action, reward, next_state, done):
        """Store experience in replay memory."""
        self.memory.append((state, action, reward, next_state, done))
    
    def act(self, state):
        """Choose action from state using epsilon-greedy policy."""
        if np.random.rand() <= self.epsilon:
            return random.randrange(self.action_size)
        
        state_tensor = torch.FloatTensor(state).unsqueeze(0).to(self.device)
        state_tensor = state_tensor.permute(0, 3, 1, 2)  # [batch, channels, height, width]
        self.policy_net.eval()
        with torch.no_grad():
            action_values = self.policy_net(state_tensor)
        self.policy_net.train()
        return torch.argmax(action_values).item()
    
    def replay(self):
        """Train on batch of experiences from replay memory."""
        if len(self.memory) < self.batch_size:
            return 0
            
        # Sample batch from memory
        minibatch = random.sample(self.memory, self.batch_size)
        
        states = []
        targets = []
        
        for state, action, reward, next_state, done in minibatch:
            # Convert to tensors
            state_tensor = torch.FloatTensor(state).to(self.device)
            state_tensor = state_tensor.permute(2, 0, 1)  # [channels, height, width]
            next_state_tensor = torch.FloatTensor(next_state).to(self.device)
            next_state_tensor = next_state_tensor.permute(2, 0, 1)  # [channels, height, width]
            
            # Calculate target
            target = reward
            if not done:
                with torch.no_grad():
                    target += self.gamma * torch.max(
                        self.target_net(next_state_tensor.unsqueeze(0))
                    ).item()
            
            # Update target for action taken
            target_f = self.policy_net(state_tensor.unsqueeze(0))
            target_f = target_f.detach().cpu().numpy()[0]
            target_f[action] = target
            
            # Append to training batch
            states.append(state_tensor.unsqueeze(0))
            targets.append(torch.FloatTensor(target_f).unsqueeze(0))
        
        # Convert lists to tensors
        states = torch.cat(states, dim=0)
        targets = torch.cat(targets, dim=0).to(self.device)
        
        # Train the network
        self.optimizer.zero_grad()
        outputs = self.policy_net(states)
        loss = F.mse_loss(outputs, targets)
        loss.backward()
        self.optimizer.step()
        
        # Decay epsilon
        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay
            
        return loss.item()
    
    def update_target_network(self):
        """Update target network weights with policy network weights."""
        self.target_net.load_state_dict(self.policy_net.state_dict())
    
    def save(self, path):
        """Save policy network weights."""
        torch.save(self.policy_net.state_dict(), path)
    
    def load(self, path):
        """Load policy network weights."""
        weights = torch.load(path)
        self.policy_net.load_state_dict(weights)
        self.target_net.load_state_dict(weights)

class EvacuationRL:
    """Main class for training and evaluating RL-based evacuation strategies."""
    
    def __init__(self, grid_size=50, num_agents=100, use_gpu=True):
        self.grid_size = grid_size
        self.num_agents = num_agents
        self.use_gpu = use_gpu
        
    def train(self, building_layout=None, hazards=None, episodes=1000, render=False, use_mock=False):
        """Train an RL agent for evacuation optimization."""
        # If mock mode is enabled, return fake training results immediately
        if use_mock or os.environ.get('DEV_MODE') == 'mock':
            logger.info(f"Generating mock training results with: grid_size={self.grid_size}, num_agents={self.num_agents}, episodes={episodes}")
            
            # Generate mock training results that vary based on input parameters
            base_reward = self.grid_size / 10.0  # Base reward scales with grid size
            agent_factor = self.num_agents / 100.0  # Agent factor scales with number of agents
            
            # Create patterns that vary based on parameters
            rewards_history = []
            evacuation_times = []
            gini_history = []
            
            for i in range(episodes):
                # Reward increases over time, scaled by parameters
                progress_factor = i / episodes
                reward = base_reward * (1 + progress_factor * 2) * agent_factor * (0.9 + 0.2 * random.random())
                rewards_history.append(float(reward))
                
                # Evacuation time decreases over time, scaled by parameters
                evac_time = (100 - (70 * progress_factor)) * (self.num_agents / 50.0) * (0.9 + 0.2 * random.random())
                evacuation_times.append(int(max(10, evac_time)))
                
                # Gini coefficient decreases over time (fairness improves)
                gini = max(0.05, 0.5 - (0.4 * progress_factor) * (0.9 + 0.2 * random.random()))
                gini_history.append(float(gini))
            
            logger.info(f"Generated mock data with final reward: {rewards_history[-1]:.2f}, " 
                       f"final evacuation time: {evacuation_times[-1]}, final gini: {gini_history[-1]:.2f}")
            
            return {
                'rewards': rewards_history,
                'evacuation_times': evacuation_times,
                'gini_history': gini_history,
                'losses': [0.1 * (0.99 ** i) * (0.9 + 0.2 * random.random()) for i in range(episodes)],
                'mock_data': True
            }
        
        # Create environment
        env = EvacuationEnvironment(
            grid_size=self.grid_size,
            num_agents=self.num_agents,
            building_layout=building_layout,
            hazards=hazards
        )
        
        # Initialize agent
        state_shape = env.reset().shape
        agent = RLAgent(state_shape, action_size=8, use_gpu=self.use_gpu)
        
        # Training metrics
        rewards_history = []
        evacuation_times = []
        gini_history = []
        losses = []
        
        # Training loop
        for episode in range(episodes):
            # Reset environment
            state = env.reset()
            done = False
            total_reward = 0
            step = 0
            
            while not done:
                # Choose and take action
                action = agent.act(state)
                next_state, reward, done, info = env.step(action)
                
                # Remember experience
                agent.remember(state, action, reward, next_state, done)
                
                # Move to next state
                state = next_state
                total_reward += reward
                step += 1
                
                # Train on batch of experiences
                loss = agent.replay()
                if loss > 0:
                    losses.append(loss)
            
            # Update target network periodically
            if episode % agent.update_target_frequency == 0:
                agent.update_target_network()
            
            # Record metrics
            rewards_history.append(total_reward)
            evacuation_times.append(step)
            
            # Calculate Gini coefficient
            if env.exits and info['evacuated'] > 0:
                # Count evacuated agents per exit
                exit_usage = np.zeros(len(env.exits))
                for i, (x, y) in enumerate(env.agent_positions):
                    if env.agent_status[i] == 1:  # Evacuated
                        min_dist = float('inf')
                        used_exit = 0
                        for j, exit_pos in enumerate(env.exits):
                            ex, ey = int(exit_pos[0] * env.grid_size / 20), int(exit_pos[1] * env.grid_size / 20)
                            dist = np.sqrt((x - ex)**2 + (y - ey)**2)
                            if dist < min_dist:
                                min_dist = dist
                                used_exit = j
                        exit_usage[used_exit] += 1
                
                if np.sum(exit_usage) > 0:
                    exit_usage = exit_usage / np.sum(exit_usage)
                    gini = env._calculate_gini(exit_usage)
                    gini_history.append(gini)
            
            # Print progress
            if (episode + 1) % 10 == 0:
                print(f"Episode {episode + 1}/{episodes}")
                print(f"  Reward: {total_reward:.2f}")
                print(f"  Evacuation Time: {step}")
                print(f"  Evacuated: {info['evacuated']}/{env.num_agents}")
                if len(gini_history) > 0:
                    print(f"  Exit Gini Coefficient: {gini_history[-1]:.4f}")
                if len(losses) > 0:
                    print(f"  Average Loss: {np.mean(losses[-100:]):.6f}")
                print(f"  Epsilon: {agent.epsilon:.4f}")
        
        # Save final model
        agent.save("models/evacuation_rl_model.pt")
        
        # Return training metrics
        return {
            'rewards': rewards_history,
            'evacuation_times': evacuation_times,
            'gini_history': gini_history,
            'losses': losses
        }
    
    def evaluate(self, model_path, building_layout=None, hazards=None, episodes=10):
        """Evaluate a trained RL agent."""
        # Create environment
        env = EvacuationEnvironment(
            grid_size=self.grid_size,
            num_agents=self.num_agents,
            building_layout=building_layout,
            hazards=hazards
        )
        
        # Initialize agent
        state_shape = env.reset().shape
        agent = RLAgent(state_shape, action_size=8, use_gpu=self.use_gpu)
        
        # Load trained weights
        agent.load(model_path)
        agent.epsilon = 0.0  # No exploration during evaluation
        
        # Evaluation metrics
        evacuation_times = []
        success_rates = []
        gini_values = []
        
        for episode in range(episodes):
            state = env.reset()
            done = False
            step = 0
            
            while not done:
                # Choose action (no exploration)
                state_tensor = torch.FloatTensor(state).unsqueeze(0).to(agent.device)
                state_tensor = state_tensor.permute(0, 3, 1, 2)  # [batch, channels, height, width]
                with torch.no_grad():
                    action_values = agent.policy_net(state_tensor)
                action = torch.argmax(action_values).item()
                
                # Take action
                next_state, _, done, info = env.step(action)
                state = next_state
                step += 1
            
            # Record metrics
            evacuation_times.append(step)
            success_rates.append(info['evacuated'] / env.num_agents)
            
            # Calculate final Gini coefficient for exit usage
            if env.exits and info['evacuated'] > 0:
                exit_usage = np.zeros(len(env.exits))
                for i, (x, y) in enumerate(env.agent_positions):
                    if env.agent_status[i] == 1:  # Evacuated
                        min_dist = float('inf')
                        used_exit = 0
                        for j, exit_pos in enumerate(env.exits):
                            ex, ey = int(exit_pos[0] * env.grid_size / 20), int(exit_pos[1] * env.grid_size / 20)
                            dist = np.sqrt((x - ex)**2 + (y - ey)**2)
                            if dist < min_dist:
                                min_dist = dist
                                used_exit = j
                        exit_usage[used_exit] += 1
                
                if np.sum(exit_usage) > 0:
                    exit_usage = exit_usage / np.sum(exit_usage)
                    gini = env._calculate_gini(exit_usage)
                    gini_values.append(gini)
        
        # Calculate average metrics
        avg_time = np.mean(evacuation_times)
        avg_success = np.mean(success_rates)
        avg_gini = np.mean(gini_values) if gini_values else 0
        
        return {
            'avg_evacuation_time': avg_time,
            'avg_success_rate': avg_success,
            'avg_gini_coefficient': avg_gini,
            'evacuation_times': evacuation_times,
            'success_rates': success_rates,
            'gini_values': gini_values
        }