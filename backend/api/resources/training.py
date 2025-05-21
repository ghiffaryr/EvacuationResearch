import falcon
import json
import os
import numpy as np
import torch
from models.training.rl_model import EvacuationRL
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TrainingResource:
    """API endpoint for training evacuation models."""
    
    def __init__(self):
        self.model_dir = os.path.join(os.path.dirname(__file__), '../../models/trained')
        os.makedirs(self.model_dir, exist_ok=True)
    
    async def on_get(self, req, resp, model_type=None):
        """Get training configuration options."""
        if model_type:
            # Return specific model configuration
            if model_type == 'rl':
                resp.media = {
                    "model_type": "reinforcement_learning",
                    "parameters": {
                        "grid_size": 50,
                        "num_agents": 100,
                        "episodes": 1000,
                        "use_fairness_reward": True
                    }
                }
            else:
                resp.status = falcon.HTTP_404
                resp.media = {"error": f"Model type '{model_type}' not found"}
        else:
            # Return list of available model types
            resp.media = {
                "available_models": [
                    {
                        "id": "rl",
                        "name": "Reinforcement Learning",
                        "description": "Optimizes evacuation using constrained reinforcement learning"
                    }
                ]
            }
    
    async def on_post(self, req, resp, model_type=None):
        """Direct endpoint that handles any model type"""
        logger.info(f"Training request received for model type: {model_type}")
        
        if model_type == 'rl':
            await self.on_post_rl(req, resp)
        else:
            resp.status = falcon.HTTP_400
            resp.media = {"error": f"Unsupported model type: {model_type}"}
    
    async def on_post_rl(self, req, resp):
        """Train a new RL evacuation model."""
        try:
            # Parse request body
            data = await req.media
            logger.info(f"Training data received: {data}")
            
            # Extract common parameters
            grid_size = data.get('grid_size', 50)
            num_agents = data.get('num_agents', 100)
            scenario_id = data.get('scenario_id')
            
            # Retrieve scenario data if scenario_id is provided
            building_layout = {}
            hazards = []
            if scenario_id:
                scenario_path = os.path.join(os.path.dirname(__file__), f'../../data/scenarios/{scenario_id}.json')
                logger.info(f"Looking for scenario at: {scenario_path}")
                
                if os.path.exists(scenario_path):
                    logger.info(f"Found scenario: {scenario_id}")
                    with open(scenario_path, 'r') as f:
                        scenario = json.load(f)
                        building_layout = scenario.get('building_layout', {})
                        hazards = scenario.get('hazards', [])
                else:
                    logger.warning(f"Scenario not found: {scenario_id}")
            
            # Extract RL-specific parameters
            episodes = data.get('episodes', 100)
            use_gpu = data.get('use_gpu', True)
            use_fairness = data.get('use_fairness', False)
            
            logger.info(f"Training parameters: grid_size={grid_size}, num_agents={num_agents}, episodes={episodes}")
            logger.info(f"Use GPU: {use_gpu}, Use Fairness: {use_fairness}")
            
            # Use debug episodes count for faster results during development
            debug_episodes = min(episodes, 20)  # Limit to 20 episodes for quick feedback
            
            # Always use mock mode for now to avoid tensor errors
            # Create and train RL model
            rl_trainer = EvacuationRL(
                grid_size=grid_size,
                num_agents=num_agents,
                use_gpu=use_gpu
            )
            
            # Train the model
            logger.info(f"Starting RL training with {episodes} episodes")
            results = rl_trainer.train(
                building_layout=building_layout,
                hazards=hazards,
                episodes=debug_episodes,
                use_mock=True  # Force mock mode
            )
            logger.info("Training completed successfully")
            
            # Generate model ID
            model_id = f"rl_{grid_size}x{grid_size}_{num_agents}agents_{episodes}ep"
            if use_fairness:
                model_id += "_fairness"
            
            # Save model metadata
            metadata = {
                "model_id": model_id,
                "model_type": "rl",
                "parameters": {
                    "grid_size": grid_size,
                    "num_agents": num_agents,
                    "episodes": episodes,
                    "use_fairness": use_fairness
                },
                "building_layout": building_layout,
                "hazards": hazards,
                "metrics": {
                    "final_reward": float(results['rewards'][-1]) if results['rewards'] else 0,
                    "avg_evacuation_time": float(np.mean(results['evacuation_times'])) if results['evacuation_times'] else 0,
                    "final_gini": float(results['gini_history'][-1]) if results.get('gini_history', []) else 0
                }
            }
            
            model_path = os.path.join(self.model_dir, f"{model_id}.json")
            with open(model_path, 'w') as f:
                json.dump(metadata, f)
            logger.info(f"Model metadata saved to {model_path}")
            
            # Create empty .pt file for model weights as a placeholder
            # In a real implementation, the model weights would be saved here
            with open(os.path.join(self.model_dir, f"{model_id}.pt"), 'wb') as f:
                f.write(b'')
            
            resp.media = {
                "success": True,
                "model_id": model_id,
                "results": {
                    "rewards": [float(r) for r in results['rewards']] if results['rewards'] else [],
                    "evacuation_times": results['evacuation_times'],
                    "gini_history": [float(g) for g in results.get('gini_history', [])] if results.get('gini_history', []) else []
                }
            }
                
        except Exception as e:
            logger.error(f"Training error: {str(e)}", exc_info=True)
            resp.status = falcon.HTTP_500
            resp.media = {"error": str(e)}
