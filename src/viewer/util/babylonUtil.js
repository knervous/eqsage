import BABYLON from '@bjs';
const {
  AbstractMesh,
  Color3,
  Color4,
  Vector3,
  Material,
  Mesh,
  StandardMaterial,
  PointerEventTypes,
  MeshBuilder,
  PointerDragBehavior,
} = BABYLON;

// Module-level variable to track the current mover
let currentMover = null;
let dragging = false;
function onHover(pointerInfo) {
  if (currentMover && !dragging) {
    switch (pointerInfo.type) {
      case PointerEventTypes.POINTERMOVE:
        const pickResult = this.pick(this.pointerX, this.pointerY);
        if (pickResult.hit) {
          let planeHit = false;
          for (const plane of currentMover.controlPlanes) {
            if (pickResult.pickedMesh === plane) {
              planeHit = true;
              plane.material.alpha = 0.8;
            } else {
              plane.material.alpha = 0.15;
            }
          }
          if (!planeHit) {
            for (const plane of currentMover.controlPlanes) {
              plane.material.alpha = 0.3;
            }
          }
        }
        break;
      default:
        break;
    }
  }
}

/**
 * Initializes the 3D mover on a given mesh within the specified scene.
 * Ensures that only one mover is active at a time by tearing down any existing mover.
 *
 * @param {Scene} scene - The Babylon.js scene.
 * @param {AbstractMesh} mesh - The mesh to be controlled.
 */
export const instantiate3dMover = (scene, mesh, callback = () => {}) => {
  if (currentMover) {
    teardown3dMover(scene);
  }
  const originalIsPickable = mesh.isPickable;
  mesh.isPickable = true;
  const controlPlanes = createControlPlanes(scene, mesh);
  // scene.onPointerObservable.add(onHover.bind(scene));
  const dragBehaviors = addDragBehavior(scene, controlPlanes, mesh, callback);
  currentMover = {
    controlPlanes,
    dragBehaviors,
    mesh,
    originalIsPickable,
  };
};

/**
 * Tears down the current 3D mover, disposing of all associated meshes, materials, and behaviors.
 */
export const teardown3dMover = (scene) => {
  if (!currentMover) {
    return; // No mover to teardown
  }
  scene.onPointerObservable.remove(onHover);
  const { controlPlanes, dragBehaviors, mesh, originalIsPickable } =
    currentMover;
  mesh.isPickable = originalIsPickable;
  // Dispose control planes and their materials
  controlPlanes.forEach((plane) => {
    // Remove and dispose behaviors
    plane.behaviors.forEach((behavior) => {
      plane.removeBehavior(behavior);
    });

    // Dispose materials
    if (plane.material) {
      plane.material.dispose();
    }

    // Dispose the plane mesh
    plane.dispose();
  });

  // Clear the currentMover reference
  currentMover = null;
};

let planeSize = 0;
/**
 * Creates control planes for the XY, ZX, and ZY planes with distinct colors and increased size.
 *
 * @param {Scene} scene - The Babylon.js scene.
 * @param {AbstractMesh} mesh - The mesh to be controlled.
 * @returns {Mesh[]} - Array of control plane meshes.
 */
export function createControlPlanes(scene, mesh) {
  const planes = [];

  // Define plane configurations with distinct colors and increased size
  const planeConfigs = [
    {
      name  : 'XYPlane',
      normal: new Vector3(0, 0, 1),
      color : new Color4(1, 0, 0, 0.3),
    }, // Red
    {
      name  : 'ZXPlane',
      normal: new Vector3(0, 0, 1),
      color : new Color4(0, 1, 0, 0.3),
    }, // Green
    {
      name  : 'ZYPlane',
      normal: new Vector3(0, 0, 1),
      color : new Color4(0, 0, 1, 0.3),
    }, // Blue
  ];
  planeSize = Math.min(mesh.getBoundingInfo().diagonalLength / 2, 15);
  planeConfigs.forEach((config) => {
    const plane = MeshBuilder.CreatePlane(
      config.name,
      { size: planeSize },
      scene
    );
    plane.rotation = Vector3.Zero();
    plane.billboardMode = Mesh.BILLBOARDMODE_NONE;
    plane.isPickable = true;
    plane.parent = mesh;

    // Align the plane based on its normal
    if (config.name === 'XYPlane') {
      plane.rotation.z = 0;
    } else if (config.name === 'ZXPlane') {
      plane.rotation.x = Math.PI / 2;
    } else if (config.name === 'ZYPlane') {
      plane.rotation.y = Math.PI / 2;
    }

    // Position the plane at the mesh's position

    // Apply material with distinct color and semi-transparency
    const mat = new StandardMaterial(`${config.name}_Mat`, scene);
    mat.emissiveColor = new Color3(
      config.color.r,
      config.color.g,
      config.color.b
    );
    mat.diffuseColor = new Color3(
      config.color.r,
      config.color.g,
      config.color.b
    );
    mat.alpha = config.color.a; // Set transparency
    mat.backFaceCulling = false;
    mat.disableDepthWrite = true; // Prevent z-buffer issues
    mat.depthPrePass = false; // Disable depth pre-pass

    // Optional: Enhance visibility through walls
    mat.transparencyMode = Material.MATERIAL_ALPHABLEND; // Ensure proper blending

    plane.material = mat;
    plane.metadata = {
      normal       : config.normal,
      emissiveColor: mat.emissiveColor,
    };

    plane.renderingGroupId = 1;

    // Ensure planes are rendered even when occluded
    plane.forceRenderingWhenOccluded = true;
    plane.occlusionType = AbstractMesh.OCCLUSION_TYPE_OPTIMISTIC;

    planes.push(plane);
  });

  return planes;
}
/**
 *
 * @param {*} scene
 * @param {*} planes
 * @param {Mesh} mesh
 * @returns
 */
function addDragBehavior(scene, planes, mesh, callback) {
  const dragBehaviors = [];

  planes.forEach((plane) => {
    const dragBehavior = new PointerDragBehavior({
      dragPlaneNormal                : plane.metadata.normal,
      useObjectOrientationForDragging: false,
    });
    plane.addBehavior(dragBehavior);
    dragBehaviors.push(dragBehavior);
    const y = mesh.getBoundingInfo().boundingBox.extendSize._y + planeSize;
    dragBehavior.onDragStartObservable.add(() => {
      dragging = true;
      plane.material.alpha = 0.5;
      planes.forEach((p) => {
        if (p === plane) {
          return;
        }
        p.material.alpha = 0.1;
      });
    });
    /** @type {Vector3} */
    const initialPosition = new Vector3(0, y, 0);
    plane.position = initialPosition;
    dragBehavior.onDragObservable.add((event) => {
      const diff = plane.position.subtract(initialPosition);
      mesh.position.addInPlace(diff);
      plane.position = new Vector3(0, y, 0);
    });

    dragBehavior.onDragEndObservable.add(() => {
      dragging = false;
      callback(mesh.position);
      plane.material.alpha = 0.3;
      planes.forEach((p) => {
        if (p === plane) {
          return;
        }
        p.material.alpha = 0.3;
      });
    });
  });

  return dragBehaviors;
}
