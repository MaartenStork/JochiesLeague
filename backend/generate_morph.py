"""
Generate a morph GIF from two images using the node mapping.
Run this once to create the GIF, then serve it statically.
"""

import json
import numpy as np
from PIL import Image
import imageio
from scipy.interpolate import griddata
from scipy.ndimage import map_coordinates
import os

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
IANMORPH_DIR = os.path.join(SCRIPT_DIR, '..', 'frontend', 'public', 'ianmorph')

IMG1_PATH = os.path.join(IANMORPH_DIR, 'IAN1.jpg')
IMG2_PATH = os.path.join(IANMORPH_DIR, 'IAN2.jpg')
NODES_PATH = os.path.join(IANMORPH_DIR, 'nodes (1).json')
OUTPUT_PATH = os.path.join(IANMORPH_DIR, 'ian_morph.gif')

# Settings
NUM_FRAMES = 40  # More frames = smoother animation
FRAME_DURATION = 0.05  # 20fps, total 2 seconds
OUTPUT_SIZE = (800, 800)  # Higher resolution for quality

# Zoom/crop settings - zoom into center to remove sidebars
ZOOM_FACTOR = 1.4  # 1.0 = no zoom, higher = more zoomed in


def load_nodes(path):
    """Load the node mapping from JSON."""
    with open(path, 'r') as f:
        data = json.load(f)
    return data[0], data[1]  # nodes1, nodes2


def create_mesh_grid(nodes, size):
    """Convert node list to mesh grid coordinates."""
    points = []
    values_x = []
    values_y = []
    
    for node in nodes:
        points.append([node['u'], node['v']])
        values_x.append(node['x'])
        values_y.append(node['y'])
    
    return np.array(points), np.array(values_x), np.array(values_y)


def warp_image_bilinear(img, nodes, size):
    """Warp an image with bilinear interpolation for smooth results."""
    h, w = size
    
    # Create output coordinate grid
    y_coords, x_coords = np.mgrid[0:h, 0:w]
    y_norm = y_coords / h
    x_norm = x_coords / w
    
    # Get node mapping
    points, dest_x, dest_y = create_mesh_grid(nodes, size)
    
    grid_points = np.column_stack([x_norm.ravel(), y_norm.ravel()])
    
    # Map destination -> source
    source_x = griddata(
        np.column_stack([dest_x, dest_y]), 
        points[:, 0], 
        grid_points, 
        method='cubic',
        fill_value=0.5
    ).reshape(h, w)
    
    source_y = griddata(
        np.column_stack([dest_x, dest_y]), 
        points[:, 1], 
        grid_points, 
        method='cubic',
        fill_value=0.5
    ).reshape(h, w)
    
    # Convert to pixel coordinates
    img_h, img_w = img.shape[:2]
    sample_x = source_x * (img_w - 1)
    sample_y = source_y * (img_h - 1)
    
    # Clip to valid range
    sample_x = np.clip(sample_x, 0, img_w - 1)
    sample_y = np.clip(sample_y, 0, img_h - 1)
    
    # Use bilinear interpolation for each channel
    warped = np.zeros((h, w, 3), dtype=np.uint8)
    for c in range(3):
        warped[:, :, c] = map_coordinates(
            img[:, :, c].astype(np.float64),
            [sample_y, sample_x],
            order=1,  # Bilinear
            mode='nearest'
        ).astype(np.uint8)
    
    return warped


def interpolate_nodes(nodes1, nodes2, t):
    """Interpolate between two node sets."""
    interpolated = []
    for n1, n2 in zip(nodes1, nodes2):
        interpolated.append({
            'x': n1['x'] * (1 - t) + n2['x'] * t,
            'y': n1['y'] * (1 - t) + n2['y'] * t,
            'u': n1['u'],
            'v': n1['v']
        })
    return interpolated


def crop_center_zoom(img, zoom_factor):
    """Crop and zoom into center of image."""
    h, w = img.shape[:2]
    
    # Calculate crop region
    crop_h = int(h / zoom_factor)
    crop_w = int(w / zoom_factor)
    
    start_y = (h - crop_h) // 2
    start_x = (w - crop_w) // 2
    
    # Crop
    cropped = img[start_y:start_y+crop_h, start_x:start_x+crop_w]
    
    # Resize back to original size
    cropped_pil = Image.fromarray(cropped)
    resized = cropped_pil.resize((w, h), Image.Resampling.LANCZOS)
    
    return np.array(resized)


def generate_morph_gif():
    """Generate the morph GIF."""
    print("Loading images...")
    img1 = Image.open(IMG1_PATH).convert('RGB')
    img2 = Image.open(IMG2_PATH).convert('RGB')
    
    # Resize to output size (high quality)
    img1 = img1.resize(OUTPUT_SIZE, Image.Resampling.LANCZOS)
    img2 = img2.resize(OUTPUT_SIZE, Image.Resampling.LANCZOS)
    
    img1_np = np.array(img1)
    img2_np = np.array(img2)
    
    print("Loading node mapping...")
    nodes1, nodes2 = load_nodes(NODES_PATH)
    
    print(f"Generating {NUM_FRAMES} frames at {OUTPUT_SIZE[0]}x{OUTPUT_SIZE[1]}...")
    frames = []
    
    for i in range(NUM_FRAMES):
        t = i / (NUM_FRAMES - 1)
        print(f"  Frame {i+1}/{NUM_FRAMES} (t={t:.2f})")
        
        # Warp both images to interpolated positions
        warped1 = warp_image_bilinear(img1_np, interpolate_nodes(nodes1, nodes2, t), OUTPUT_SIZE)
        warped2 = warp_image_bilinear(img2_np, interpolate_nodes(nodes2, nodes1, 1-t), OUTPUT_SIZE)
        
        # Cross-fade between warped images
        alpha = t
        blended = (warped1.astype(np.float64) * (1 - alpha) + warped2.astype(np.float64) * alpha).astype(np.uint8)
        
        # Zoom into center to remove sidebars
        zoomed = crop_center_zoom(blended, ZOOM_FACTOR)
        
        frames.append(zoomed)
    
    # Save as GIF - play ONCE (loop=1 means play once then stop... but for GIF we need a different approach)
    # GIF loop: 0 = infinite, 1+ = play that many times. But most browsers ignore this.
    # We'll set loop=1 but note that browser support varies
    print(f"Saving GIF to {OUTPUT_PATH}...")
    imageio.mimsave(
        OUTPUT_PATH, 
        frames, 
        duration=FRAME_DURATION,
        loop=1  # Play once (though browser support varies)
    )
    
    # Also save as WebP - better quality and supports loop control
    webp_path = OUTPUT_PATH.replace('.gif', '.webp')
    print(f"Saving WebP to {webp_path}...")
    imageio.mimsave(
        webp_path,
        frames,
        duration=FRAME_DURATION,
        loop=1  # Play once
    )
    
    print("Done!")
    print(f"GIF size: {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB")
    if os.path.exists(webp_path):
        print(f"WebP size: {os.path.getsize(webp_path) / 1024:.1f} KB")


if __name__ == '__main__':
    generate_morph_gif()
