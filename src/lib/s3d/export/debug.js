
// import { Color3, MeshBuilder, Quaternion, StandardMaterial, TransformNode, Vector3, } from '../../../common/bjs';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3, Quaternion, Vector2, Vector4 } from '@babylonjs/core/Maths/math.vector';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Light } from '@babylonjs/core/Lights/light';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { Tools } from '@babylonjs/core/Misc/tools';
import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { Color3Gradient } from '@babylonjs/core/Misc/gradients';
import { CubeTexture } from '@babylonjs/core/Materials/Textures/cubeTexture';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';

/**
 * Visualize the BSP result in Babylon.js
 *
 * @param {BABYLON.Scene} scene - An existing Babylon.js scene
 * @param {Object} bspData - The result from createBsp(dmSpriteDef2s),
 *    containing { WorldTrees: [{ WorldNodes: [...] }], Regions: [...], Zones: [...] }
 */
let bspRoot;
let planeRoot;

export function toggleRegion() {
  if (bspRoot) {
    for (const child of bspRoot.getChildMeshes()) {
      if (!child.metadata.zone) {
        child.setEnabled(!child.isEnabled());
      }
    }
  }
}

/**
 * Creates a Babylon.js mesh from an array of polygons.
 * @param {Array} polygons - Array of polygon objects.
 * @param {BABYLON.Scene} scene - The Babylon.js scene.
 * @param {BABYLON.TransformNode} parent - (Optional) Parent node to attach the mesh.
 * @returns {BABYLON.Mesh} - The created mesh.
 */
function createMeshFromPolygons(polygons, scene, parent = null) {
  const uniqueVertices = [];
  const vertexMap = new Map(); // To avoid duplicates
  const indices = [];

  // Helper function to create a unique key for a vertex
  const vertexKey = (v) => `${v.x.toFixed(6)}_${v.y.toFixed(6)}_${v.z.toFixed(6)}`;

  polygons.forEach((polygon) => {
    polygon.vertices.forEach((v) => {
      const key = vertexKey(v);
      if (!vertexMap.has(key)) {
        vertexMap.set(key, uniqueVertices.length);
        uniqueVertices.push(new Vector3(v.x, v.z, v.y));
      }
    });

    // Assuming each polygon is a triangle
    const idx0 = vertexMap.get(vertexKey(polygon.vertices[0]));
    const idx1 = vertexMap.get(vertexKey(polygon.vertices[1]));
    const idx2 = vertexMap.get(vertexKey(polygon.vertices[2]));

    indices.push(idx0, idx1, idx2);
  });

  // Create the mesh
  const mesh = new Mesh('aggregatedMesh', scene);
  
  // Assign the mesh to the parent if provided
  if (parent) {
    mesh.parent = parent;
  }

  // Create VertexData
  const vertexData = new VertexData();
  vertexData.positions = uniqueVertices.flatMap(v => [v.x, v.y, v.z]);
  vertexData.indices = indices;

  // Apply the vertex data to the mesh
  vertexData.applyToMesh(mesh, true);

  // Optional: Create a material for better visualization
  const material = new StandardMaterial('meshMaterial', scene);
  material.emissiveColor = new Color3(0.4, 0.6, 0.8);
  material.backFaceCulling = false; // Render both sides
  mesh.material = material;
  mesh.isPickable = true;
  // Enable collisions if needed
  mesh.checkCollisions = false;

  return mesh;
}

export function createBspVisualization(scene, bspData, doDrawPlanes = false, onlyDivider = false, size = 300, doPolys = false) {
  console.log('hmr 123');
  bspRoot?.dispose?.();
  planeRoot?.dispose?.();
  const { WorldTrees, Regions, Zones } = bspData;
  if (!WorldTrees || !WorldTrees.length) {
    console.warn('No WorldTrees found in BSP data.');
    return null;
  }
  
  // Create a transform node to parent all BSbspVisualizationRootP visuals
  bspRoot = new TransformNode('bspVisualizationRoot', scene);
  planeRoot = new TransformNode('planeRoot', scene);
  
  // 1) Visualize each leaf region as a translucent sphere
  Regions.forEach((region, idx) => {

    if (region.polygons && doPolys) {
      createMeshFromPolygons(region.polygons, scene, bspRoot);
    } else if (!doPolys) {
      // region.Sphere is [cx, cy, cz, radius]
      const [cx, cz, cy, radius] = region.Sphere || [0, 0, 0, 0];
      // Create a sphere for the region
      // const sphere = MeshBuilder.CreateSphere(
      //     `regionSphere_${region.Tag}`,
      //     { segments: 8, diameter: radius * 2 },
      //     scene
      // );
      const size = radius * 2;
      // Create a box for the region
      const sphere = MeshBuilder.CreateBox(
        `regionBox_${region.Tag}`,
        {
          width : size,
          height: size,
          depth : size,
        },
        scene
      );
  
      // Positio
      // Position at the region center
      sphere.position.set(cx, cy, cz);
  
      // Give it a random color (or color by region type)
      const material = new StandardMaterial(`mat_${region.Tag}`, scene);
      material.diffuseColor = new Color3(
        Math.random(), 
        Math.random(), 
        Math.random()
      );
      material.alpha = 0.1; // make it a bit translucent
      sphere.material = material;
      const zone = Zones.find(z => z.Regions.includes(idx - 1));
      if (zone) {
        material.emissiveColor = new Color3(127, 0, 0);
        material.alpha = 0.5;
      }
      // Store any metadata you want to retrieve later
      sphere.metadata = {
        debug      : true,
        isBspRegion: true,
        regionTag  : region.Tag,
        userData   : region.UserData, // e.g. "DRN__..." if you added custom data
        regionIndex: idx,
        zone
      };
      sphere.isPickable = true;
      // Parent to the main root
      sphere.parent = bspRoot;

    }
    
  });
  
  // 2) (Optional) Visualize the BSP planes from WorldTrees[0].WorldNodes
  // Each node has:
  //    {
  //      Normals: [nx, ny, nz, d],
  //      WorldRegionTag,
  //      FrontTree,
  //      BackTree,
  //      Distance
  //    }
  
  const nodes = WorldTrees[0].WorldNodes;
  
  /**
     * Recursively draw the tree planes as grid-like meshes or lines (optional).
     * Here is a simple example that draws a debug plane for each node.
     * 
     * @param {Number} nodeIndex - 1-based index into WorldNodes array
     */
  function drawNodePlane(nodeIndex, parentTransform, onlyDivider) {
    if (nodeIndex <= 0) {
      return;
    }
  
    const nodeData = nodes[nodeIndex - 1]; // nodeIndex is 1-based
    const [nx, nz, ny, d] = nodeData.Normals || [0, 1, 0, 0];
  
    // If this node is not a leaf, it has a plane that splits space
    // We can create a large "debug plane" in the 3D world. 
    // This is purely for visualization; you might want to limit the size or clip it.
    const planeNormal = new Vector3(nx, ny, nz).normalize();
    // Distance from origin is -d / length(normal), but we already normalized it:
    const distance = -d; 
  
    // Create a TransformNode to hold the plane's position/orientation
    const planeTransform = new TransformNode(`bspPlaneNode_${nodeIndex}`, scene);
    planeTransform.parent = parentTransform;
  
    // Position the plane so that it sits at the correct distance along the normal
    planeTransform.position = planeNormal.scale(distance);
  
    // Align the plane to face outward. The default plane from CreateGround() is aligned to +Y, so we rotate.
    // We can compute a quaternion to rotate (0,1,0) => (nx, ny, nz)
    const upVec = new Vector3(0, 1, 0);
    if (!planeNormal.equalsWithEpsilon(upVec) && !planeNormal.equalsWithEpsilon(upVec.scale(-1))) {
      const axis = Vector3.Cross(upVec, planeNormal).normalize();
      const angle = Math.acos(Vector3.Dot(upVec, planeNormal));
      const quat = Quaternion.RotationAxis(axis, angle);
      planeTransform.rotationQuaternion = quat;
    } else if (planeNormal.equalsWithEpsilon(upVec.scale(-1))) {
      // If the normal is basically down, we can do a simple 180 deg rotation
      planeTransform.rotation.x = Math.PI;
    }
  
    // Create a debug plane mesh (e.g. 200x200 size)
    const debugPlane = MeshBuilder.CreateGround(
        `debugPlane_${nodeIndex}`,
        {
          width       : size,
          height      : size,
          subdivisions: 1,
        },
        scene
    );
    debugPlane.parent = planeTransform;
    debugPlane.isPickable = true;
    debugPlane.setEnabled(true);
  
    // Give it a semi-transparent material so we can see it
    const planeMat = new StandardMaterial(`planeMat_${nodeIndex}`, scene);
    planeMat.emissiveColor = nodeData.regionDivider ? new Color3(0.2, 0.4, 0) : new Color3(0, 0.5, 0.5); // red

    planeMat.alpha = 0.2;
    planeMat.backFaceCulling = false;

    debugPlane.material = planeMat;
  
    // Create a dynamic texture to display the index number
    const dynamicTexture = new DynamicTexture(
      `dynamicTexture_${nodeIndex}`,
      { width: 512, height: 512 },
      scene,
      true
    );
    dynamicTexture.hasAlpha = true;

    // Draw the index number on the texture
    const textureContext = dynamicTexture.getContext();
    textureContext.clearRect(0, 0, 512, 512);
    textureContext.font = 'bold 120px Arial';
    textureContext.fillStyle = 'white'; // Text color
    textureContext.textAlign = 'center';
    textureContext.textBaseline = 'middle';
    textureContext.fillText(`${nodeIndex}`, 256, 256); // Draw text in the center
    dynamicTexture.update();
    debugPlane.metadata = {
      debug: {
        index: nodeIndex,
        nodeData
      }
    };

    // Apply the dynamic texture to a material
    // planeMat.diffuseTexture = dynamicTexture;
    planeMat.backFaceCulling = false; // Enable rendering on both sides
    if (onlyDivider && !nodeData.regionDivider) {
      debugPlane.dispose();
      planeMat.dispose();
    }
    // Recurse into front & back
    drawNodePlane(nodeData.FrontTree, parentTransform, onlyDivider);
    drawNodePlane(nodeData.BackTree, parentTransform, onlyDivider);
  }
  
  // Uncomment if you want to see the planes:
  // drawNodePlane(1, bspRoot);
  if (doDrawPlanes) {
    drawNodePlane(1, planeRoot, onlyDivider);
    bspRoot.setEnabled(false);
    window.debugPlane = idx => {
      planeRoot.getChildMeshes().forEach(m => {
        if (idx.includes(m.metadata.debug.index)) {
          m.setEnabled(true);
        } else {
          m.setEnabled(false);
        }
      });
    };
    window.debugPlaneClear = () => {
      planeRoot.getChildMeshes().forEach(m => m.setEnabled(true));
    };
  }
  return bspRoot;
}
  