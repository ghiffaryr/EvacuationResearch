import uuid
import os
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

def create_sample_scenarios():
    """
    Create realistic evacuation scenarios with proper architectural layouts
    Returns a list of created scenario IDs
    """
    scenarios_dir = os.path.join(os.path.dirname(__file__), 'scenarios')
    os.makedirs(scenarios_dir, exist_ok=True)

    # Check if we already have scenarios
    flag_file = os.path.join(scenarios_dir, '.samples_created')
    if os.path.exists(flag_file) or len([f for f in os.listdir(scenarios_dir) if f.endswith('.json')]) > 0:
        print("Sample scenarios already exist, skipping creation")
        return []
    
    # Define sample scenarios
    scenarios = [
        # Classroom scenario
        {
            "id": str(uuid.uuid4()),
            "name": "Classroom Evacuation",
            "description": "A standard classroom with 30 students, arranged desks, and a fire hazard",
            "type": "building",
            "num_agents": 31,  # 30 students + 1 teacher
            "panic_factor": 1.2,
            "time_steps": 100,
            "building_layout": {
                "walls": [
                    # Standard rectangular classroom (8m x 10m)
                    [[0, 0], [8, 0]],    # Bottom wall
                    [[0, 0], [0, 10]],   # Left wall
                    [[0, 10], [8, 10]],  # Top wall
                    [[8, 0], [8, 10]],   # Right wall
                ],
                "exits": [
                    [4, 0]  # Door at the bottom center
                ],
                "initial_positions": [
                    # Teacher position at front of room
                    {"x": 4, "y": 8.5, "count": 1},
                    
                    # Students in rows of desks
                    # Row 1
                    {"x": 1.5, "y": 2, "count": 5},
                    {"x": 1.5, "y": 3.5, "count": 5},
                    # Row 2
                    {"x": 4, "y": 2, "count": 5},
                    {"x": 4, "y": 3.5, "count": 5},
                    # Row 3
                    {"x": 6.5, "y": 2, "count": 5},
                    {"x": 6.5, "y": 3.5, "count": 5},
                    # Back row
                    {"x": 4, "y": 5, "count": 5}
                ]
            },
            "hazards": [
                # Fire hazard - starts near the electrical panel
                {
                    "position": [7.5, 7],
                    "type": "fire",
                    "radius": 1.0,
                    "intensity": 0.8,
                    "spread_rate": 0.03
                },
                # Floor
                {
                    "position": [4, 5],
                    "type": "floor",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [8.0, 10.0],
                    "texture": "tiles"
                },
                # Ceiling
                {
                    "position": [4, 5],
                    "type": "ceiling",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [8.0, 10.0],
                    "height": 3.0,
                    "texture": "plaster"
                },
                # Main door
                {
                    "position": [4, 0.1],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [1.5, 2.0],
                    "is_open": True
                },
                # Windows along the left wall
                {
                    "position": [0.1, 2.5],
                    "type": "window",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [0.1, 1.5],
                    "is_transparent": True
                },
                {
                    "position": [0.1, 5.0],
                    "type": "window",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [0.1, 1.5],
                    "is_transparent": True
                },
                {
                    "position": [0.1, 7.5],
                    "type": "window",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [0.1, 1.5],
                    "is_transparent": True
                },
                
                # Teacher desk
                {
                    "position": [4, 9],
                    "type": "table",
                    "radius": 0.75,
                    "intensity": 1.0,
                    "dimensions": [2.0, 1.0],
                    "texture": "wood"
                },
                # Teacher chair
                {
                    "position": [4, 8.3],
                    "type": "chair",
                    "radius": 0.45,
                    "intensity": 1.0,
                    "dimensions": [0.5, 0.5],
                    "texture": "fabric"
                },
                
                # Student desks and chairs - Row 1
                {
                    "position": [1.5, 2.3],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.8, 0.6],
                    "texture": "wood"
                },
                {
                    "position": [1.5, 1.8],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.4, 0.4],
                    "texture": "plastic"
                },
                {
                    "position": [1.5, 3.8],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.8, 0.6],
                    "texture": "wood"
                },
                {
                    "position": [1.5, 3.3],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.4, 0.4],
                    "texture": "plastic"
                },
                
                # Student desks and chairs - Row 2
                {
                    "position": [4, 2.3],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.8, 0.6],
                    "texture": "wood"
                },
                {
                    "position": [4, 1.8],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.4, 0.4],
                    "texture": "plastic"
                },
                {
                    "position": [4, 3.8],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.8, 0.6],
                    "texture": "wood"
                },
                {
                    "position": [4, 3.3],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.4, 0.4],
                    "texture": "plastic"
                },
                
                # Student desks and chairs - Row 3
                {
                    "position": [6.5, 2.3],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.8, 0.6],
                    "texture": "wood"
                },
                {
                    "position": [6.5, 1.8],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.4, 0.4],
                    "texture": "plastic"
                },
                {
                    "position": [6.5, 3.8],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.8, 0.6],
                    "texture": "wood"
                },
                {
                    "position": [6.5, 3.3],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.4, 0.4],
                    "texture": "plastic"
                },
                
                # Back row
                {
                    "position": [4, 5.3],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.8, 0.6],
                    "texture": "wood"
                },
                {
                    "position": [4, 4.8],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.4, 0.4],
                    "texture": "plastic"
                }
            ]
        },
        
        # Office Building scenario
        {
            "id": str(uuid.uuid4()),
            "name": "Office Building Evacuation",
            "description": "An office floor with workstations, meeting rooms, and an earthquake hazard",
            "type": "building",
            "num_agents": 50,
            "panic_factor": 1.3,
            "time_steps": 150,
            "building_layout": {
                "walls": [
                    # Building outline (20m x 15m)
                    [[0, 0], [20, 0]],   # Bottom wall
                    [[0, 0], [0, 15]],   # Left wall
                    [[0, 15], [20, 15]], # Top wall
                    [[20, 0], [20, 15]], # Right wall
                    
                    # Main corridor
                    [[0, 7], [20, 7]],   # Horizontal corridor
                    
                    # Meeting rooms
                    [[0, 11], [5, 11]],  # Meeting room 1 top
                    [[5, 7], [5, 15]],   # Meeting room divider
                    [[10, 7], [10, 15]], # Meeting room divider
                    [[15, 7], [15, 15]], # Meeting room divider
                    
                    # Office spaces
                    [[5, 0], [5, 7]],   # Office divider
                    [[10, 0], [10, 7]], # Office divider
                    [[15, 0], [15, 7]], # Office divider
                ],
                "exits": [
                    [10, 0],   # Main entrance
                    [20, 7.5], # Emergency exit
                ],
                "initial_positions": [
                    # Open office area with workstations
                    {"x": 2.5, "y": 3.5, "count": 8},
                    {"x": 7.5, "y": 3.5, "count": 8},
                    {"x": 12.5, "y": 3.5, "count": 8},
                    {"x": 17.5, "y": 3.5, "count": 8},
                    
                    # Meeting rooms
                    {"x": 2.5, "y": 13, "count": 6},
                    {"x": 7.5, "y": 13, "count": 4},
                    {"x": 12.5, "y": 13, "count": 4},
                    {"x": 17.5, "y": 13, "count": 4},
                ]
            },
            "hazards": [
                # Earthquake hazard
                {
                    "position": [10, 7.5],
                    "type": "earthquake",
                    "radius": 10.0,
                    "intensity": 0.7,
                    "duration": 10,
                    "aftershocks": True
                },
                # Floor for entire office
                {
                    "position": [10, 7.5],
                    "type": "floor",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [20.0, 15.0],
                    "texture": "carpet"
                },
                # Ceiling
                {
                    "position": [10, 7.5],
                    "type": "ceiling",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [20.0, 15.0],
                    "height": 2.7,
                    "texture": "tiles"
                },
                # Main entrance door
                {
                    "position": [10, 0.1],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [2.0, 2.0],
                    "is_open": True
                },
                # Emergency exit door
                {
                    "position": [19.9, 7.5],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [1.0, 2.0],
                    "is_open": True
                },
                # Meeting room doors
                {
                    "position": [2.5, 7.1],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [1.0, 2.0],
                    "is_open": True
                },
                {
                    "position": [7.5, 7.1],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [1.0, 2.0],
                    "is_open": True
                },
                {
                    "position": [12.5, 7.1],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [1.0, 2.0],
                    "is_open": True
                },
                {
                    "position": [17.5, 7.1],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [1.0, 2.0],
                    "is_open": True
                },
                # Windows
                {
                    "position": [0.1, 3],
                    "type": "window",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [0.1, 2.0],
                    "is_transparent": True
                },
                {
                    "position": [0.1, 13],
                    "type": "window",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [0.1, 2.0],
                    "is_transparent": True
                },
                
                # Conference table in Meeting Room 1
                {
                    "position": [2.5, 13],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [3.0, 1.5],
                    "texture": "wood"
                },
                # Chairs around conference table
                {
                    "position": [1.5, 12.5],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.5, 0.5],
                    "texture": "fabric"
                },
                {
                    "position": [2.5, 12.5],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.5, 0.5],
                    "texture": "fabric"
                },
                {
                    "position": [3.5, 12.5],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.5, 0.5],
                    "texture": "fabric"
                },
                {
                    "position": [1.5, 13.5],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.5, 0.5],
                    "texture": "fabric"
                },
                {
                    "position": [2.5, 13.5],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.5, 0.5],
                    "texture": "fabric"
                },
                {
                    "position": [3.5, 13.5],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.5, 0.5],
                    "texture": "fabric"
                },
                
                # Office desks and chairs in open office areas
                # Section 1
                {
                    "position": [2, 3],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [1.2, 0.8],
                    "texture": "wood"
                },
                {
                    "position": [2, 2.5],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.5, 0.5],
                    "texture": "fabric"
                },
                {
                    "position": [3.5, 3],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [1.2, 0.8],
                    "texture": "wood"
                },
                {
                    "position": [3.5, 2.5],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.5, 0.5],
                    "texture": "fabric"
                },
                # Section 2 - similar pattern for other areas
                {
                    "position": [7, 3],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [1.2, 0.8],
                    "texture": "wood"
                },
                {
                    "position": [7, 2.5],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.5, 0.5],
                    "texture": "fabric"
                },
                {
                    "position": [8.5, 3],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [1.2, 0.8],
                    "texture": "wood"
                },
                {
                    "position": [8.5, 2.5],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.5, 0.5],
                    "texture": "fabric"
                }
            ]
        },
        
        # Stadium scenario
        {
            "id": str(uuid.uuid4()),
            "name": "Stadium Evacuation",
            "description": "A small stadium section with tiered seating and field access",
            "type": "stadium",
            "num_agents": 120,
            "panic_factor": 1.5,
            "time_steps": 200,
            "building_layout": {
                "walls": [
                    # Stadium section 
                    [[0, 0], [20, 0]],    # Field-side boundary
                    [[0, 0], [0, 15]],    # Left boundary
                    [[0, 15], [20, 15]],  # Back boundary
                    [[20, 0], [20, 15]],  # Right boundary
                    
                    # Stairs/aisles dividing seating sections
                    [[5, 0], [5, 15]],    # Left aisle
                    [[15, 0], [15, 15]],  # Right aisle
                    
                    # Separators between seating tiers
                    [[0, 5], [20, 5]],    # First tier separator
                    [[0, 10], [20, 10]]   # Second tier separator
                ],
                "exits": [
                    [5, 0],   # Field-level exit (left)
                    [15, 0],  # Field-level exit (right)
                    [10, 15]  # Concourse exit (back)
                ],
                "initial_positions": [
                    # First tier (closest to field)
                    {"x": 2.5, "y": 2.5, "count": 15},
                    {"x": 10, "y": 2.5, "count": 15},
                    {"x": 17.5, "y": 2.5, "count": 15},
                    
                    # Second tier 
                    {"x": 2.5, "y": 7.5, "count": 15},
                    {"x": 10, "y": 7.5, "count": 15},
                    {"x": 17.5, "y": 7.5, "count": 15},
                    
                    # Third tier (back)
                    {"x": 2.5, "y": 12.5, "count": 15},
                    {"x": 10, "y": 12.5, "count": 15},
                    {"x": 17.5, "y": 12.5, "count": 15}
                ]
            },
            "hazards": [
                # Fire hazard (concession stand fire)
                {
                    "position": [10, 14.5],
                    "type": "fire",
                    "radius": 2.0,
                    "intensity": 0.9,
                    "spread_rate": 0.04
                },
                # Stadium floor/ground
                {
                    "position": [10, 7.5],
                    "type": "floor",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [20.0, 15.0],
                    "texture": "concrete"
                },
                # Field (grass at the bottom)
                {
                    "position": [10, -2.5],
                    "type": "grass",
                    "radius": 0.2,
                    "intensity": 1.0,
                    "dimensions": [20.0, 5.0],
                    "texture": "grass"
                },
                # Stadium seating - represented as tables in tiers
                # First tier
                {
                    "position": [2.5, 2.5],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [4.0, 4.0],
                    "texture": "plastic"
                },
                {
                    "position": [10, 2.5],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [4.0, 4.0],
                    "texture": "plastic"
                },
                {
                    "position": [17.5, 2.5],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [4.0, 4.0],
                    "texture": "plastic"
                },
                # Second tier
                {
                    "position": [2.5, 7.5],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [4.0, 4.0],
                    "texture": "plastic"
                },
                {
                    "position": [10, 7.5],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [4.0, 4.0],
                    "texture": "plastic"
                },
                {
                    "position": [17.5, 7.5],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [4.0, 4.0],
                    "texture": "plastic"
                },
                # Third tier
                {
                    "position": [2.5, 12.5],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [4.0, 4.0],
                    "texture": "plastic"
                },
                {
                    "position": [10, 12.5],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [4.0, 4.0],
                    "texture": "plastic"
                },
                {
                    "position": [17.5, 12.5],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [4.0, 4.0],
                    "texture": "plastic"
                },
                # Exit doors
                {
                    "position": [5, 0.1],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [2.0, 2.0],
                    "is_open": True
                },
                {
                    "position": [15, 0.1],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [2.0, 2.0],
                    "is_open": True
                },
                {
                    "position": [10, 14.9],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [2.0, 2.0],
                    "is_open": True
                }
            ]
        },
        
        # Park scenario
        {
            "id": str(uuid.uuid4()),
            "name": "Park Evacuation",
            "description": "A public park with pathways, open areas, and a flood hazard",
            "type": "public",
            "num_agents": 60,
            "panic_factor": 1.2,
            "time_steps": 150,
            "building_layout": {
                "walls": [
                    # Park boundary - represented as low walls/fences
                    [[0, 0], [30, 0]],    # South boundary
                    [[0, 0], [0, 20]],    # West boundary
                    [[0, 20], [30, 20]],  # North boundary
                    [[30, 0], [30, 20]],  # East boundary
                    
                    # Decorative structures/obstacles (small pavilion)
                    [[12, 12], [18, 12]], # Pavilion south
                    [[12, 12], [12, 18]], # Pavilion west
                    [[12, 18], [18, 18]], # Pavilion north
                    [[18, 12], [18, 18]]  # Pavilion east
                ],
                "exits": [
                    [15, 0],   # South gate
                    [0, 10],   # West gate
                    [30, 10],  # East gate
                    [15, 20]   # North gate
                ],
                "initial_positions": [
                    # People distributed throughout the park
                    # Near pavilion
                    {"x": 15, "y": 15, "count": 10},
                    # Near playground area (southeast)
                    {"x": 24, "y": 5, "count": 15},
                    # Near picnic area (southwest)
                    {"x": 6, "y": 5, "count": 15},
                    # Near pond (northwest)
                    {"x": 6, "y": 15, "count": 10},
                    # Central path
                    {"x": 15, "y": 10, "count": 10}
                ]
            },
            "hazards": [
                # Flash flood from the north
                {
                    "position": [15, 20],
                    "type": "flood",
                    "radius": 7.0,
                    "intensity": 0.8,
                    "rise_rate": 0.05,
                    "flow_direction": [0, -1]  # Flowing south
                },
                # Base soil throughout the park
                {
                    "position": [15, 10],
                    "type": "soil",
                    "radius": 0.3,
                    "intensity": 1.0,
                    "dimensions": [30.0, 20.0],
                    "texture": "dirt"
                },
                # Grass areas
                {
                    "position": [7.5, 10],
                    "type": "grass",
                    "radius": 0.2,
                    "intensity": 1.0,
                    "dimensions": [15.0, 15.0],
                    "texture": "grass"
                },
                {
                    "position": [22.5, 10],
                    "type": "grass",
                    "radius": 0.2,
                    "intensity": 1.0,
                    "dimensions": [15.0, 15.0],
                    "texture": "grass"
                },
                # Tall grass in certain areas
                {
                    "position": [6, 15],
                    "type": "grass",
                    "radius": 0.3,
                    "intensity": 1.0,
                    "dimensions": [5.0, 5.0],
                    "texture": "tall_grass"
                },
                # Pavilion floor
                {
                    "position": [15, 15],
                    "type": "floor",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [6.0, 6.0],
                    "texture": "concrete"
                },
                # Pavilion ceiling
                {
                    "position": [15, 15],
                    "type": "ceiling",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [6.0, 6.0],
                    "height": 3.0,
                    "texture": "wood"
                },
                # Park benches (represented as tables)
                {
                    "position": [5, 5],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [1.5, 0.6],
                    "texture": "wood"
                },
                {
                    "position": [10, 5],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [1.5, 0.6],
                    "texture": "wood"
                },
                {
                    "position": [20, 5],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [1.5, 0.6],
                    "texture": "wood"
                },
                {
                    "position": [25, 5],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [1.5, 0.6],
                    "texture": "wood"
                },
                {
                    "position": [5, 15],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [1.5, 0.6],
                    "texture": "wood"
                },
                # Pavilion tables and chairs
                {
                    "position": [15, 15],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [2.0, 1.2],
                    "texture": "wood"
                },
                {
                    "position": [14, 14.5],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.5, 0.5],
                    "texture": "wood"
                },
                {
                    "position": [16, 14.5],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.5, 0.5],
                    "texture": "wood"
                },
                {
                    "position": [14, 15.5],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.5, 0.5],
                    "texture": "wood"
                },
                {
                    "position": [16, 15.5],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.5, 0.5],
                    "texture": "wood"
                },
                # Park gates
                {
                    "position": [15, 0.1],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [3.0, 2.0],
                    "is_open": True
                },
                {
                    "position": [0.1, 10],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [2.0, 3.0],
                    "is_open": True
                },
                {
                    "position": [29.9, 10],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [2.0, 3.0],
                    "is_open": True
                },
                {
                    "position": [15, 19.9],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [3.0, 2.0],
                    "is_open": True
                }
            ]
        },
        
        # Shopping Mall scenario
        {
            "id": str(uuid.uuid4()),
            "name": "Shopping Mall Evacuation",
            "description": "A shopping mall with stores, a food court, and a structural failure hazard",
            "type": "mall",
            "num_agents": 150,
            "panic_factor": 1.4,
            "time_steps": 200,
            "building_layout": {
                "walls": [
                    # Mall exterior (30m x 25m)
                    [[0, 0], [30, 0]],    # South wall
                    [[0, 0], [0, 25]],    # West wall
                    [[0, 25], [30, 25]],  # North wall
                    [[30, 0], [30, 25]],  # East wall
                    
                    # Main corridor running east-west
                    [[0, 10], [30, 10]],   # Lower corridor wall
                    [[0, 15], [30, 15]],   # Upper corridor wall
                    
                    # Store dividers - south side
                    [[5, 0], [5, 10]],
                    [[10, 0], [10, 10]],
                    [[15, 0], [15, 10]],
                    [[20, 0], [20, 10]],
                    [[25, 0], [25, 10]],
                    
                    # Store dividers - north side
                    [[5, 15], [5, 25]],
                    [[10, 15], [10, 25]],
                    [[15, 15], [15, 25]],
                    [[20, 15], [20, 25]],
                    [[25, 15], [25, 25]]
                ],
                "exits": [
                    [15, 0],   # Main entrance (south)
                    [30, 12.5], # East emergency exit
                    [0, 12.5],  # West emergency exit
                    [15, 25]    # North exit
                ],
                "initial_positions": [
                    # Main corridor (mall patrons walking)
                    {"x": 7.5, "y": 12.5, "count": 20},
                    {"x": 15, "y": 12.5, "count": 20},
                    {"x": 22.5, "y": 12.5, "count": 20},
                    
                    # South stores
                    {"x": 2.5, "y": 5, "count": 10},
                    {"x": 7.5, "y": 5, "count": 10},
                    {"x": 12.5, "y": 5, "count": 10},
                    {"x": 17.5, "y": 5, "count": 10},
                    {"x": 22.5, "y": 5, "count": 10},
                    {"x": 27.5, "y": 5, "count": 10},
                    
                    # North stores
                    {"x": 2.5, "y": 20, "count": 10},
                    {"x": 7.5, "y": 20, "count": 10},
                    {"x": 12.5, "y": 20, "count": 10},
                    {"x": 17.5, "y": 20, "count": 10},
                    {"x": 22.5, "y": 20, "count": 10},
                    {"x": 27.5, "y": 20, "count": 10}
                ]
            },
            "hazards": [
                # Structural damage (ceiling collapse near center)
                {
                    "position": [15, 15],
                    "type": "structural",
                    "radius": 3.0,
                    "intensity": 0.9,
                    "is_debris": True
                },
                # Mall floor
                {
                    "position": [15, 12.5],
                    "type": "floor",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [30.0, 25.0],
                    "texture": "tiles"
                },
                # Mall ceiling
                {
                    "position": [15, 12.5],
                    "type": "ceiling",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [30.0, 25.0],
                    "height": 4.0,
                    "texture": "tiles"
                },
                # Store entrances - south side
                {
                    "position": [2.5, 10],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [2.0, 2.0],
                    "is_open": True
                },
                {
                    "position": [7.5, 10],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [2.0, 2.0],
                    "is_open": True
                },
                {
                    "position": [12.5, 10],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [2.0, 2.0],
                    "is_open": True
                },
                {
                    "position": [17.5, 10],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [2.0, 2.0],
                    "is_open": True
                },
                {
                    "position": [22.5, 10],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [2.0, 2.0],
                    "is_open": True
                },
                {
                    "position": [27.5, 10],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [2.0, 2.0],
                    "is_open": True
                },
                # Store entrances - north side
                {
                    "position": [2.5, 15],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [2.0, 2.0],
                    "is_open": True
                },
                {
                    "position": [7.5, 15],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [2.0, 2.0],
                    "is_open": True
                },
                {
                    "position": [12.5, 15],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [2.0, 2.0],
                    "is_open": True
                },
                {
                    "position": [17.5, 15],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [2.0, 2.0],
                    "is_open": True
                },
                {
                    "position": [22.5, 15],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [2.0, 2.0],
                    "is_open": True
                },
                {
                    "position": [27.5, 15],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [2.0, 2.0],
                    "is_open": True
                },
                # Main exits
                {
                    "position": [15, 0.1],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [5.0, 2.0],
                    "is_open": True
                },
                {
                    "position": [29.9, 12.5],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [2.0, 3.0],
                    "is_open": True
                },
                {
                    "position": [0.1, 12.5],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [2.0, 3.0],
                    "is_open": True
                },
                {
                    "position": [15, 24.9],
                    "type": "door",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [3.0, 2.0],
                    "is_open": True
                },
                # Store display tables
                {
                    "position": [2.5, 5],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [3.0, 1.5],
                    "texture": "wood"
                },
                {
                    "position": [7.5, 5],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [3.0, 1.5],
                    "texture": "wood"
                },
                {
                    "position": [12.5, 5],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [3.0, 1.5],
                    "texture": "wood"
                },
                # Food court seating area
                {
                    "position": [27, 17],
                    "type": "table",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [1.0, 1.0],
                    "texture": "plastic"
                },
                {
                    "position": [27, 18],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.5, 0.5],
                    "texture": "plastic"
                },
                {
                    "position": [27, 16],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.5, 0.5],
                    "texture": "plastic"
                },
                {
                    "position": [28, 17],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.5, 0.5],
                    "texture": "plastic"
                },
                {
                    "position": [26, 17],
                    "type": "chair",
                    "radius": 0.4,
                    "intensity": 1.0,
                    "dimensions": [0.5, 0.5],
                    "texture": "plastic"
                },
                # Store windows
                {
                    "position": [15, 0.1],
                    "type": "window",
                    "radius": 0.1,
                    "intensity": 1.0,
                    "dimensions": [10.0, 3.0],
                    "is_transparent": True
                }
            ]
        }
    ]
    
    # Save each scenario to a JSON file
    created = []
    for scenario in scenarios:
        scenario_id = scenario["id"]
        scenario_path = os.path.join(scenarios_dir, f"{scenario_id}.json")
        
        with open(scenario_path, 'w') as f:
            json.dump(scenario, f, indent=2)
        
        created.append(scenario_id)
        logger.info(f"Created scenario: {scenario['name']} ({scenario_id})")
    
    # Create flag file to indicate samples have been created
    try:
        with open(flag_file, 'w') as f:
            f.write('1')
    except Exception as e:
        print(f"Warning: Could not create sample flag file: {e}")
        
    return created

if __name__ == "__main__":
    create_sample_scenarios()
