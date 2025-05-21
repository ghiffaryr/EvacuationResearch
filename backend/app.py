import falcon
import falcon.asgi
import json
import os
import logging
import sys

# Import our custom ASGI-compatible CORS middleware
from middleware.asgi_cors import CORSMiddleware
from api.routes import register_routes

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create necessary directories
scenarios_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'scenarios')
os.makedirs(scenarios_dir, exist_ok=True)
os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models', 'trained'), exist_ok=True)

# Direct sample scenario creation without imports
def create_sample_scenarios_directly():
    try:
        logger.info("Creating sample scenarios directly")
        
        # Sample scenarios data
        import uuid
        
        scenarios = [
            # Office Building layout
            {
                "id": str(uuid.uuid4()),
                "name": "Office Building",
                "description": "Standard office floor with multiple exits and corridors",
                "type": "building",
                "num_agents": 120,
                "panic_factor": 1.2,
                "time_steps": 100,
                "building_layout": {
                    "walls": [
                        [[2, 2], [18, 2]],   # Top wall
                        [[2, 2], [2, 18]],   # Left wall
                        [[18, 2], [18, 18]], # Right wall
                        [[2, 18], [18, 18]], # Bottom wall
                        [[6, 2], [6, 8]],    # Office divider 1
                        [[12, 2], [12, 8]],  # Office divider 2
                        [[6, 12], [14, 12]], # Meeting room wall
                        [[14, 8], [14, 16]]  # Corridor wall
                    ],
                    "exits": [
                        [10, 18],  # Main exit
                        [18, 10]   # Emergency exit
                    ]
                },
                "hazards": []
            },
            
            # Shopping Mall with Fire
            {
                "id": str(uuid.uuid4()),
                "name": "Shopping Mall with Fire",
                "description": "Large shopping mall with multiple exits and a fire hazard",
                "type": "mall",
                "num_agents": 250,
                "panic_factor": 1.5,
                "time_steps": 120,
                "building_layout": {
                    "walls": [
                        [[1, 1], [19, 1]],   # Top wall
                        [[1, 1], [1, 19]],   # Left wall
                        [[19, 1], [19, 19]], # Right wall
                        [[1, 19], [19, 19]]  # Bottom wall
                    ],
                    "exits": [
                        [10, 1],   # North exit
                        [10, 19],  # South exit
                        [1, 10],   # West exit
                        [19, 10]   # East exit
                    ]
                },
                "hazards": [
                    {
                        "position": [7, 8],
                        "type": "fire",
                        "radius": 2.0,
                        "intensity": 0.9
                    }
                ]
            },
            
            # Stadium Evacuation
            {
                "id": str(uuid.uuid4()),
                "name": "Stadium Evacuation",
                "description": "Large stadium with multiple exits and high occupancy",
                "type": "stadium",
                "num_agents": 500,
                "panic_factor": 1.3,
                "time_steps": 150,
                "building_layout": {
                    "walls": [
                        [[4, 1], [16, 1]],   # Top
                        [[1, 5], [1, 15]],   # Left
                        [[4, 19], [16, 19]], # Bottom
                        [[19, 5], [19, 15]]  # Right
                    ],
                    "exits": [
                        [10, 1],   # North exit
                        [10, 19],  # South exit
                        [1, 10],   # West exit
                        [19, 10]   # East exit
                    ]
                },
                "hazards": []
            }
        ]
        
        # Write scenarios to files
        for scenario in scenarios:
            with open(os.path.join(scenarios_dir, f"{scenario['id']}.json"), 'w') as f:
                json.dump(scenario, f, indent=2)
        
        logger.info(f"Created {len(scenarios)} sample scenarios")
        return scenarios
    except Exception as e:
        logger.error(f"Error creating sample scenarios: {str(e)}", exc_info=True)
        return []

# Create sample scenarios
create_sample_scenarios_directly()

# Set up CORS with our ASGI-compatible middleware
cors = CORSMiddleware(
    allow_origins=['http://localhost:5173', 'http://localhost:3000', 'http://frontend:3000'],
    allow_all_headers=True,
    allow_all_methods=True
)

# Set up the Falcon API as an ASGI app
app = falcon.asgi.App(middleware=[cors])

# Register API routes
register_routes(app)

# Health check endpoint
class HealthCheckResource:
    async def on_get(self, req, resp):
        resp.media = {"status": "healthy", "version": "1.0.0"}
        resp.status = falcon.HTTP_200

app.add_route('/health', HealthCheckResource())

# Create a development-mode model for quick testing
def create_test_model():
    model_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models', 'trained')
    model_id = "rl_sample_model"
    model_meta_path = os.path.join(model_dir, f"{model_id}.json")
    model_weights_path = os.path.join(model_dir, f"{model_id}.pt")
    
    # Only create if it doesn't exist
    if not os.path.exists(model_meta_path):
        meta = {
            "model_id": model_id,
            "model_type": "rl",
            "parameters": {
                "grid_size": 50,
                "num_agents": 100,
                "episodes": 100,
                "use_fairness": True
            },
            "metrics": {
                "final_reward": 85.5,
                "avg_evacuation_time": 45.2,
                "final_gini": 0.2
            }
        }
        with open(model_meta_path, 'w') as f:
            json.dump(meta, f)
            
        # Create empty model weights file as placeholder
        with open(model_weights_path, 'wb') as f:
            f.write(b'')
        
        logger.info(f"Created test model: {model_id}")

# Create test model in dev mode
if os.environ.get("DEV_MODE") == "true":
    create_test_model()

# Serve static files
if __name__ == '__main__':
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port="8000", reload=True)
