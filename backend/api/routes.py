import falcon
import json
import os
from api.resources.scenarios import ScenarioResource
from api.resources.simulation import SimulationResource
from api.resources.training import TrainingResource
from api.resources.evaluation import EvaluationResource
import logging

logger = logging.getLogger(__name__)

def register_routes(app):
    """Register API routes with the Falcon app."""
    
    # Scenario routes
    logger.info("Registering scenario routes")
    scenario_resource = ScenarioResource()
    app.add_route('/api/scenarios', scenario_resource)
    app.add_route('/api/scenarios/{scenario_id}', scenario_resource)
    
    # Simulation routes
    logger.info("Registering simulation routes")
    simulation_resource = SimulationResource()
    app.add_route('/api/simulate/microscopic', simulation_resource, suffix='microscopic')
    app.add_route('/api/simulate/mesoscopic', simulation_resource, suffix='mesoscopic')
    app.add_route('/api/simulate/macroscopic', simulation_resource, suffix='macroscopic')
    
    # Training routes
    logger.info("Registering training routes")
    training_resource = TrainingResource()
    app.add_route('/api/train', training_resource)
    app.add_route('/api/train/{model_type}', training_resource)
    app.add_route('/api/train/rl', training_resource, suffix='rl')
    
    # Evaluation routes
    logger.info("Registering evaluation routes")
    evaluation_resource = EvaluationResource()
    app.add_route('/api/evaluate', evaluation_resource)
    app.add_route('/api/evaluate/{model_id}', evaluation_resource)
