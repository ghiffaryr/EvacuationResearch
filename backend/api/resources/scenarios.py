import falcon
import json
import os
import uuid
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class ScenarioResource:
    """API endpoint for managing evacuation scenarios."""
    
    def __init__(self):
        self.scenarios_dir = os.path.join(os.path.dirname(__file__), '../../data/scenarios')
        os.makedirs(self.scenarios_dir, exist_ok=True)
        self.sample_flag_file = os.path.join(self.scenarios_dir, '.samples_created')
    
    def _get_existing_titles(self):
        """Get all existing scenario titles"""
        titles = []
        try:
            for filename in os.listdir(self.scenarios_dir):
                if filename.endswith('.json'):
                    scenario_path = os.path.join(self.scenarios_dir, filename)
                    with open(scenario_path, 'r') as f:
                        scenario = json.load(f)
                        if "name" in scenario:
                            titles.append(scenario["name"])
        except Exception as e:
            logger.error(f"Error fetching existing titles: {e}")
        return titles
    
    def _has_sample_scenarios(self):
        """Check if sample scenarios have been created"""
        return os.path.exists(self.sample_flag_file) or len(list(Path(self.scenarios_dir).glob('*.json'))) > 0
    
    def _mark_samples_created(self):
        """Mark that sample scenarios have been created"""
        try:
            with open(self.sample_flag_file, 'w') as f:
                f.write('1')
        except Exception as e:
            logger.error(f"Error creating sample flag file: {e}")

    async def on_get(self, req, resp, scenario_id=None):
        """Get scenario(s)"""
        if scenario_id:
            # Get specific scenario
            scenario_path = os.path.join(self.scenarios_dir, f"{scenario_id}.json")
            if not os.path.exists(scenario_path):
                resp.status = falcon.HTTP_404
                resp.media = {"error": f"Scenario with ID {scenario_id} not found"}
                return
                
            try:
                with open(scenario_path, 'r') as f:
                    scenario = json.load(f)
                
                resp.media = scenario
                
            except Exception as e:
                logger.error(f"Error loading scenario {scenario_id}: {e}")
                resp.status = falcon.HTTP_500
                resp.media = {"error": f"Failed to load scenario: {str(e)}"}
        
        else:
            # List all scenarios
            scenarios = []
            
            # Force create sample scenarios if none exist and samples haven't been created yet
            if not self._has_sample_scenarios():
                try:
                    from data.sample_scenarios import create_sample_scenarios
                    created_scenarios = create_sample_scenarios()
                    logger.info(f"Created {len(created_scenarios)} sample scenarios")
                    self._mark_samples_created()
                except Exception as e:
                    logger.error(f"Error creating sample scenarios: {e}")
            
            # List all scenarios
            try:
                for filename in os.listdir(self.scenarios_dir):
                    if filename.endswith('.json'):
                        scenario_path = os.path.join(self.scenarios_dir, filename)
                        with open(scenario_path, 'r') as f:
                            scenario = json.load(f)
                            # Include only necessary fields for listing
                            scenarios.append({
                                "id": scenario.get("id"),
                                "name": scenario.get("name"),
                                "description": scenario.get("description"),
                                "type": scenario.get("type")
                            })
                
                resp.media = {"scenarios": scenarios}
                
            except Exception as e:
                logger.error(f"Error listing scenarios: {e}")
                resp.status = falcon.HTTP_500
                resp.media = {"error": f"Failed to list scenarios: {str(e)}"}
    
    async def on_post(self, req, resp):
        """Create a new scenario"""
        try:
            scenario_data = await req.media
            
            # Generate ID if not provided
            if not scenario_data.get("id"):
                scenario_data["id"] = str(uuid.uuid4())
                
            # Validate required fields
            required_fields = ["name", "building_layout"]
            for field in required_fields:
                if field not in scenario_data:
                    resp.status = falcon.HTTP_400
                    resp.media = {"error": f"Missing required field: {field}"}
                    return
            
            # Check for duplicate title
            existing_titles = self._get_existing_titles()
            if scenario_data["name"] in existing_titles:
                resp.status = falcon.HTTP_409  # Conflict
                resp.media = {"error": f"A scenario with title '{scenario_data['name']}' already exists. Please use a different title."}
                return
                    
            # Save scenario
            scenario_id = scenario_data["id"]
            scenario_path = os.path.join(self.scenarios_dir, f"{scenario_id}.json")
            
            with open(scenario_path, 'w') as f:
                json.dump(scenario_data, f, indent=2)
                
            resp.status = falcon.HTTP_201
            resp.media = {"success": True, "scenario_id": scenario_id}
            
        except Exception as e:
            logger.error(f"Error creating scenario: {e}")
            resp.status = falcon.HTTP_500
            resp.media = {"error": f"Failed to create scenario: {str(e)}"}
    
    async def on_put(self, req, resp, scenario_id):
        """Update an existing scenario"""
        scenario_path = os.path.join(self.scenarios_dir, f"{scenario_id}.json")
        if not os.path.exists(scenario_path):
            resp.status = falcon.HTTP_404
            resp.media = {"error": f"Scenario with ID {scenario_id} not found"}
            return
            
        try:
            scenario_data = await req.media
            
            # Check if name is being changed to an existing name
            if "name" in scenario_data:
                # Get current scenario name
                with open(scenario_path, 'r') as f:
                    current_scenario = json.load(f)
                    
                # If name is changed, check for uniqueness
                if scenario_data["name"] != current_scenario.get("name"):
                    existing_titles = self._get_existing_titles()
                    if scenario_data["name"] in existing_titles:
                        resp.status = falcon.HTTP_409  # Conflict
                        resp.media = {"error": f"A scenario with title '{scenario_data['name']}' already exists. Please use a different title."}
                        return
            
            # Ensure ID remains the same
            scenario_data["id"] = scenario_id
                
            # Save updated scenario
            with open(scenario_path, 'w') as f:
                json.dump(scenario_data, f, indent=2)
                
            resp.media = {"success": True, "scenario_id": scenario_id}
            
        except Exception as e:
            logger.error(f"Error updating scenario {scenario_id}: {e}")
            resp.status = falcon.HTTP_500
            resp.media = {"error": f"Failed to update scenario: {str(e)}"}
    
    async def on_delete(self, req, resp, scenario_id):
        """Delete a scenario"""
        scenario_path = os.path.join(self.scenarios_dir, f"{scenario_id}.json")
        if not os.path.exists(scenario_path):
            resp.status = falcon.HTTP_404
            resp.media = {"error": f"Scenario with ID {scenario_id} not found"}
            return
            
        try:
            os.remove(scenario_path)
            resp.media = {"success": True}
            
        except Exception as e:
            logger.error(f"Error deleting scenario {scenario_id}: {e}")
            resp.status = falcon.HTTP_500
            resp.media = {"error": f"Failed to delete scenario: {str(e)}"}
