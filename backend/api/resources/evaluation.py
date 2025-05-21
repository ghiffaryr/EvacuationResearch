import falcon
import json
import os
import numpy as np
from models.training.rl_model import EvacuationRL

class EvaluationResource:
    """API endpoint for evaluating evacuation models."""
    
    def __init__(self):
        self.model_dir = os.path.join(os.path.dirname(__file__), '../../models/trained')
    
    async def on_get(self, req, resp, model_id=None):
        """Get evaluation configuration or list of models."""
        if model_id:
            # Check if model exists
            model_path = os.path.join(self.model_dir, f"{model_id}.json")
            if not os.path.exists(model_path):
                resp.status = falcon.HTTP_404
                resp.media = {"error": f"Model '{model_id}' not found"}
                return
                
            # Return model metadata
            with open(model_path, 'r') as f:
                metadata = json.load(f)
            
            resp.media = {
                "model_id": model_id,
                "parameters": metadata.get('parameters', {}),
                "metrics": metadata.get('metrics', {}),
            }
        else:
            # List available models
            models = []
            for filename in os.listdir(self.model_dir):
                if filename.endswith('.json'):
                    model_id = os.path.splitext(filename)[0]
                    try:
                        with open(os.path.join(self.model_dir, filename), 'r') as f:
                            metadata = json.load(f)
                        models.append({
                            "model_id": model_id,
                            "model_type": metadata.get('model_type', 'unknown'),
                            "metrics": metadata.get('metrics', {})
                        })
                    except Exception as e:
                        print(f"Error loading model metadata: {e}")
            
            resp.media = {"models": models}
    
    async def on_post(self, req, resp, model_id=None):
        """Evaluate a model on a specific scenario."""
        try:
            # Parse request
            data = await req.media
            
            if not model_id:
                model_id = data.get('model_id')
                if not model_id:
                    resp.status = falcon.HTTP_400
                    resp.media = {"error": "No model_id provided"}
                    return
            
            # Check if model exists
            model_path = os.path.join(self.model_dir, f"{model_id}.pt")
            if not os.path.exists(model_path):
                resp.status = falcon.HTTP_404
                resp.media = {"error": f"Model weights '{model_id}' not found"}
                return
                
            # Get evaluation parameters
            building_layout = data.get('building_layout', {})
            hazards = data.get('hazards', [])
            episodes = data.get('episodes', 5)
            grid_size = data.get('grid_size', 50)
            num_agents = data.get('num_agents', 100)
            use_gpu = data.get('use_gpu', True)
            
            # Create evaluator
            evaluator = EvacuationRL(
                grid_size=grid_size,
                num_agents=num_agents,
                use_gpu=use_gpu
            )
            
            # Evaluate the model
            results = evaluator.evaluate(
                model_path=model_path,
                building_layout=building_layout,
                hazards=hazards,
                episodes=episodes
            )
            
            # Return evaluation results
            resp.media = {
                "success": True,
                "model_id": model_id,
                "results": {
                    "avg_evacuation_time": float(results['avg_evacuation_time']),
                    "avg_success_rate": float(results['avg_success_rate']),
                    "avg_gini_coefficient": float(results['avg_gini_coefficient']),
                    "evacuation_times": results['evacuation_times'],
                    "success_rates": [float(r) for r in results['success_rates']],
                    "gini_values": [float(g) for g in results['gini_values'] if g is not None]
                }
            }
            
        except Exception as e:
            resp.status = falcon.HTTP_500
            resp.media = {"error": str(e)}
