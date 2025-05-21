import os
import json
import uuid

def create_sample_scenarios():
    """Create sample evacuation scenarios based on research literature."""
    scenarios_dir = os.path.join(os.path.dirname(__file__), 'scenarios')
    os.makedirs(scenarios_dir, exist_ok=True)
    
    # Check if we already have scenarios
    flag_file = os.path.join(scenarios_dir, '.samples_created')
    if os.path.exists(flag_file) or len([f for f in os.listdir(scenarios_dir) if f.endswith('.json')]) > 0:
        print("Sample scenarios already exist, skipping creation")
        return []
    
    scenarios = [
        # Sample 1: Office Building Layout
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
                    [[2, 2], [18, 2]],  # Top wall
                    [[2, 2], [2, 18]],  # Left wall
                    [[18, 2], [18, 18]],  # Right wall
                    [[2, 18], [18, 18]],  # Bottom wall
                    # Interior walls
                    [[6, 2], [6, 8]],   # Office divider 1
                    [[12, 2], [12, 8]],  # Office divider 2
                    [[6, 12], [14, 12]],  # Meeting room wall
                    [[14, 8], [14, 16]]  # Corridor wall
                ],
                "exits": [
                    [10, 18],  # Main exit
                    [18, 10]   # Emergency exit
                ],
                "initial_positions": [
                    {"x": 4, "y": 5, "count": 20},  # Office area 1
                    {"x": 9, "y": 5, "count": 20},  # Office area 2
                    {"x": 15, "y": 5, "count": 20},  # Office area 3
                    {"x": 10, "y": 15, "count": 40},  # Meeting room
                    {"x": 16, "y": 14, "count": 20}   # Break area
                ]
            },
            "hazards": []
        },
        
        # Sample 2: Shopping Mall with Fire
        {
            "id": str(uuid.uuid4()),
            "name": "Shopping Mall with Fire",
            "description": "Large shopping mall with multiple exits and a fire hazard",
            "type": "mall",
            "num_agents": 250,
            "panic_factor": 1.5,  # Higher panic due to fire
            "time_steps": 120,
            "building_layout": {
                "walls": [
                    [[1, 1], [19, 1]],  # Top wall
                    [[1, 1], [1, 19]],  # Left wall
                    [[19, 1], [19, 19]],  # Right wall
                    [[1, 19], [19, 19]],  # Bottom wall
                    # Interior walls - stores
                    [[5, 1], [5, 7]],
                    [[10, 1], [10, 7]],
                    [[15, 1], [15, 7]],
                    [[5, 13], [5, 19]],
                    [[10, 13], [10, 19]],
                    [[15, 13], [15, 19]],
                    # Central area
                    [[8, 8], [12, 8]],
                    [[8, 8], [8, 12]],
                    [[8, 12], [12, 12]],
                    [[12, 8], [12, 12]]
                ],
                "exits": [
                    [10, 1],   # North exit
                    [10, 19],  # South exit
                    [1, 10],   # West exit
                    [19, 10]   # East exit
                ],
                "initial_positions": [
                    {"x": 3, "y": 4, "count": 30},  # Store 1
                    {"x": 8, "y": 4, "count": 30},  # Store 2
                    {"x": 13, "y": 4, "count": 30},  # Store 3
                    {"x": 17, "y": 4, "count": 30},  # Store 4
                    {"x": 3, "y": 16, "count": 30},  # Store 5
                    {"x": 8, "y": 16, "count": 30},  # Store 6
                    {"x": 13, "y": 16, "count": 30},  # Store 7
                    {"x": 17, "y": 16, "count": 30},  # Store 8
                    {"x": 10, "y": 10, "count": 40}   # Central area
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
        
        # Sample 3: Stadium
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
                    # Outer walls - oval shape approximated with straight lines
                    [[4, 1], [16, 1]],  # Top
                    [[1, 5], [1, 15]],  # Left
                    [[4, 19], [16, 19]],  # Bottom
                    [[19, 5], [19, 15]],  # Right
                    [[1, 5], [4, 1]],  # Top-left corner
                    [[16, 1], [19, 5]],  # Top-right corner
                    [[1, 15], [4, 19]],  # Bottom-left corner
                    [[19, 15], [16, 19]],  # Bottom-right corner
                    
                    # Inner walls (field boundary)
                    [[7, 4], [13, 4]],  # Top field
                    [[4, 8], [4, 12]],  # Left field
                    [[7, 16], [13, 16]],  # Bottom field
                    [[16, 8], [16, 12]],  # Right field
                    [[4, 8], [7, 4]],  # Top-left field corner
                    [[13, 4], [16, 8]],  # Top-right field corner
                    [[4, 12], [7, 16]],  # Bottom-left field corner
                    [[16, 12], [13, 16]]  # Bottom-right field corner
                ],
                "exits": [
                    [10, 1],   # North exit
                    [10, 19],  # South exit
                    [1, 10],   # West exit
                    [19, 10]   # East exit
                ],
                "initial_positions": [
                    # Stands distributed around the field
                    {"x": 6, "y": 3, "count": 60},  # North stands
                    {"x": 14, "y": 3, "count": 60},  # North stands
                    {"x": 3, "y": 7, "count": 60},  # West stands
                    {"x": 3, "y": 13, "count": 60},  # West stands
                    {"x": 6, "y": 17, "count": 60},  # South stands
                    {"x": 14, "y": 17, "count": 60},  # South stands
                    {"x": 17, "y": 7, "count": 60},  # East stands
                    {"x": 17, "y": 13, "count": 60},  # East stands
                    {"x": 10, "y": 10, "count": 80}   # Field
                ]
            },
            "hazards": []
        },
        
        # Sample 4: School Building with Multiple Hazards
        {
            "id": str(uuid.uuid4()),
            "name": "School with Multiple Hazards",
            "description": "School building with classrooms and multiple hazards for complex evacuation",
            "type": "school",
            "num_agents": 350,
            "panic_factor": 1.4,
            "time_steps": 130,
            "building_layout": {
                "walls": [
                    # Outer walls
                    [[1, 1], [19, 1]],  # Top
                    [[1, 1], [1, 19]],  # Left
                    [[19, 1], [19, 19]],  # Right
                    [[1, 19], [19, 19]],  # Bottom
                    
                    # Classrooms - left wing
                    [[1, 5], [7, 5]],
                    [[1, 9], [7, 9]],
                    [[1, 13], [7, 13]],
                    [[1, 17], [7, 17]],
                    
                    # Classrooms - right wing
                    [[13, 5], [19, 5]],
                    [[13, 9], [19, 9]],
                    [[13, 13], [19, 13]],
                    [[13, 17], [19, 17]],
                    
                    # Central corridor
                    [[7, 1], [7, 19]],
                    [[13, 1], [13, 19]],
                ],
                "exits": [
                    [10, 1],   # Main entrance
                    [10, 19],  # Back exit
                    [1, 7],    # Left emergency exit
                    [19, 7]    # Right emergency exit
                ],
                "initial_positions": [
                    # Left wing classrooms
                    {"x": 4, "y": 3, "count": 25},
                    {"x": 4, "y": 7, "count": 25},
                    {"x": 4, "y": 11, "count": 25},
                    {"x": 4, "y": 15, "count": 25},
                    # Right wing classrooms
                    {"x": 16, "y": 3, "count": 25},
                    {"x": 16, "y": 7, "count": 25},
                    {"x": 16, "y": 11, "count": 25},
                    {"x": 16, "y": 15, "count": 25},
                    # Central area
                    {"x": 10, "y": 10, "count": 150}
                ]
            },
            "hazards": [
                {
                    "position": [4, 6],
                    "type": "fire",
                    "radius": 1.5,
                    "intensity": 0.8
                },
                {
                    "position": [16, 14],
                    "type": "fire",
                    "radius": 1.5,
                    "intensity": 0.8
                },
                {
                    "position": [10, 5],
                    "type": "structural",
                    "radius": 2.0,
                    "intensity": 0.7
                }
            ]
        }
    ]
    
    # Write scenarios to files
    for scenario in scenarios:
        with open(os.path.join(scenarios_dir, f"{scenario['id']}.json"), 'w') as f:
            json.dump(scenario, f, indent=2)
    
    # Create flag file to indicate samples have been created
    try:
        with open(flag_file, 'w') as f:
            f.write('1')
    except Exception as e:
        print(f"Warning: Could not create sample flag file: {e}")
    
    print(f"Created {len(scenarios)} sample scenarios")
    return scenarios

if __name__ == "__main__":
    create_sample_scenarios()
