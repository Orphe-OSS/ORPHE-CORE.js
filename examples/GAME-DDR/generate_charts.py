#!/usr/bin/env python3
import json
import random

def generate_chart(difficulty, duration=120):
    """Generate a random DDR chart"""
    charts = {
        'Easy': {
            'name': 'Easy Mode',
            'interval': 2.0,  # 2 seconds per note
            'bpm': 120
        },
        'Normal': {
            'name': 'Normal Mode', 
            'interval': 1.0,  # 1 second per note
            'bpm': 120
        },
        'Hard': {
            'name': 'Hard Mode',
            'interval': 0.5,  # 0.5 seconds per note
            'bpm': 120
        }
    }
    
    config = charts[difficulty]
    notes = []
    
    # Start after 2 second offset
    current_time = 2.0
    
    # Generate notes until duration
    while current_time < duration:
        lane = random.randint(0, 3)  # Random lane 0-3
        notes.append({
            'time': round(current_time, 2),
            'lane': lane
        })
        current_time += config['interval']
    
    chart = {
        'name': config['name'],
        'difficulty': difficulty,
        'bpm': config['bpm'],
        'offset': 2.0,
        'notes': notes
    }
    
    return chart

# Generate all three difficulties
for difficulty in ['Easy', 'Normal', 'Hard']:
    chart = generate_chart(difficulty)
    
    # Map to filenames
    filename_map = {
        'Easy': 'sample.json',
        'Normal': 'medium.json',
        'Hard': 'hard.json'
    }
    
    filename = filename_map[difficulty]
    
    with open(f'assets/charts/{filename}', 'w') as f:
        json.dump(chart, f, indent=2)
    
    print(f'✅ Generated {filename}: {len(chart["notes"])} notes over {chart["notes"][-1]["time"]:.1f} seconds')

print('🎵 All charts generated!')
