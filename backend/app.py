import falcon
import falcon.asgi
import json
import os
import logging
import sys
from pathlib import Path

# Import our custom ASGI-compatible CORS middleware
from middleware.asgi_cors import CORSMiddleware
from api.routes import register_routes
from data.sample_scenarios import create_sample_scenarios

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def setup_directories():
    """Create necessary application directories."""
    base_dir = Path(__file__).parent
    
    # Create directories if they don't exist
    directories = [
        base_dir / 'data' / 'scenarios',
        base_dir / 'models' / 'trained'
    ]
    
    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)
    
    return {
        'scenarios_dir': str(directories[0]),
        'models_dir': str(directories[1])
    }

def setup_sample_data(directories):
    """Initialize sample data for the application."""
    try:
        # Generate sample scenarios using the function from data module
        create_sample_scenarios()
    except Exception as e:
        logger.error(f"Error creating sample scenarios: {str(e)}", exc_info=True)

def create_test_model(model_dir):
    """Create a development-mode model for quick testing."""
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
        
        try:
            with open(model_meta_path, 'w') as f:
                json.dump(meta, f)
                
            # Create empty model weights file as placeholder
            with open(model_weights_path, 'wb') as f:
                f.write(b'')
            
            logger.info(f"Created test model: {model_id}")
        except Exception as e:
            logger.error(f"Error creating test model: {str(e)}", exc_info=True)

class HealthCheckResource:
    """API endpoint for health status reporting."""
    async def on_get(self, req, resp):
        """Return health status of the application."""
        resp.media = {"status": "healthy", "version": "1.0.0"}
        resp.status = falcon.HTTP_200

def create_app():
    """Create and configure the ASGI application."""
    # Setup application directories
    directories = setup_directories()
    
    # Setup sample data
    setup_sample_data(directories)
    
    # Set up CORS middleware
    cors = CORSMiddleware(
        allow_origins=['http://localhost:5173', 'http://localhost:3000', 'http://frontend:3000'],
        allow_all_headers=True,
        allow_all_methods=True
    )

    # Create the Falcon API as an ASGI app
    app = falcon.asgi.App(middleware=[cors])
    
    # Register API routes
    register_routes(app)
    
    # Add health check endpoint
    app.add_route('/health', HealthCheckResource())
    
    # Create test model in dev mode
    if os.environ.get("DEV_MODE") == "true":
        create_test_model(directories['models_dir'])
    
    return app

# Create the application instance
app = create_app()

# Run the server when executed directly
if __name__ == '__main__':
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port="8000", reload=True)
