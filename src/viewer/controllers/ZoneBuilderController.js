import '@babylonjs/core/Materials/Textures/Loaders/envTextureLoader';
import '@babylonjs/core/Helpers/sceneHelpers';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { BoundingSphere } from '@babylonjs/core/Culling/boundingSphere';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';

import { Octree } from '@babylonjs/core/Culling/Octrees';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Light } from '@babylonjs/core/Lights/light';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
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
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { SubMesh } from '@babylonjs/core/Meshes/subMesh';
import { MultiMaterial } from '@babylonjs/core/Materials/multiMaterial';

import { GameControllerChild } from './GameControllerChild';
import {
  AABBNode,
  buildAABBTree,
} from '../../lib/s3d/bsp/region-utils';
import { GlobalStore } from '../../state';

class ZoneBuilderController extends GameControllerChild {
  /**
   * @type {import('@babylonjs/core/scene').Scene}
   */
  scene = null;
  hadStoredScene = false;
  zoneLoaded = false;
  zoneName = '';
  zoneMetadata = {};
  aabbTree = {};
  animatedMeshes = [];
  animationGroupMap = {};
  collideCounter = 0;
  objectAnimationPlaying = [];
  lights = [];
  lastPosition = new Vector3(0, 0, 0);
  lastAabbNode = null;
  animationRange = 200;
  objectCullRange = 2000;
  /** @type {RecastJSPlugin} */
  navigationPlugin = null;
  pickingRaycast = false;

  loadCallbacks = [];
  clickCallbacks = [];

  /**
   * @type {Object.<string, Promise<AssetContainer>}
   */
  assetContainers = {};

  addClickCallback = (cb) => {
    this.clickCallbacks.push(cb);
  };
  removeClickCallback = (cb) => {
    this.clickCallbacks = this.clickCallbacks.filter((l) => l !== cb);
  };

  addLoadCallback = (cb) => {
    this.loadCallbacks.push(cb);
  };
  removeLoadCallback = (cb) => {
    this.loadCallbacks = this.loadCallbacks.filter((l) => l !== cb);
  };
  dispose() {
    if (this.scene) {
      this.scene.unregisterBeforeRender(this.renderLoop);
      this.scene.onPointerObservable.remove(this.onClick.bind(this));
      this.scene.dispose();
    }
    this.scene = null;
    this.hadStoredScene = false;
    this.zoneLoaded = false;
    this.zoneName = '';
    this.zoneMetadata = {};
    this.aabbTree = {};
    this.animatedMeshes = [];
    this.animationGroupMap = {};
    this.collideCounter = 0;
    this.objectAnimationPlaying = [];
    this.lastPosition = new Vector3(0, 0, 0);
    this.lastAabbNode = null;

    this.zoneLoaded = false;
  }

  loadViewerScene() {
    this.dispose();
    this.scene = null;
    if (!this.engine || !this.canvas || !this.gc.engineInitialized) {
      return;
    }

    this.scene = new Scene(this.engine);

    this.scene.registerBeforeRender(this.renderLoop.bind(this));
    this.scene.onPointerDown = this.sceneMouseDown;
    this.scene.onPointerUp = this.sceneMouseUp;
    this.CameraController.createCamera(new Vector3(0, 250, 0));
    this.CameraController.camera.rotation = new Vector3(1.57, 1.548, 0);
    const glowLayer = new GlowLayer('glow', this.scene, {
      blurKernelSize: 10,
    });
    this.glowLayer = glowLayer;
    glowLayer.intensity = 0.7;
    glowLayer.customEmissiveColorSelector = function (
      mesh,
      subMesh,
      material,
      result
    ) {
      if (mesh?.metadata?.emissiveColor) {
        result.set(
          mesh?.metadata?.emissiveColor.r,
          mesh?.metadata?.emissiveColor.g,
          mesh?.metadata?.emissiveColor.b,
          0.5
        );
        if (mesh?.metadata?.occludedColor) {
          if (mesh.isOccluded) {
            result.set(
              mesh?.metadata?.occludedColor.r,
              mesh?.metadata?.occludedColor.g,
              mesh?.metadata?.occludedColor.b,
              0.5
            );
          }
        }
        if (mesh?.metadata?.onlyOccluded) {
          if (mesh.isOccluded) {
            result.set(
              mesh?.metadata?.emissiveColor.r,
              mesh?.metadata?.emissiveColor.g,
              mesh?.metadata?.emissiveColor.b,
              0.5
            );
          } else {
            result.set(
              mesh?.metadata?.emissiveColor.r,
              mesh?.metadata?.emissiveColor.g,
              mesh?.metadata?.emissiveColor.b,
              0.0
            );
          }
        }
      }
    };
    this.regionMaterial = new StandardMaterial('region-material', this.scene);

    this.regionMaterial.alpha = 0.3;
    this.regionMaterial.diffuseColor = new Color3(0, 127, 65); // Red color
    this.regionMaterial.emissiveColor = new Color4(0, 127, 65, 0.3); // Red color

    const hdrTexture = CubeTexture.CreateFromPrefilteredData(
      '/static/environment.env',
      this.scene
    );
    this.scene.environmentTexture = hdrTexture;
    this.scene.environmentIntensity = 1.0;

    // Click events
    this.scene.onPointerObservable.add(this.onClick.bind(this));

    return true;
  }

  /**
   *
   * @param {PointerInfo} pointerInfo
   */
  onClick(pointerInfo) {
    switch (pointerInfo.type) {
      case PointerEventTypes.POINTERDOWN:
        if (
          pointerInfo.pickInfo.hit &&
          (pointerInfo.pickInfo.pickedMesh?.metadata?.spawn ?? null) !== null
        ) {
          this.clickCallbacks.forEach((c) =>
            c(pointerInfo.pickInfo.pickedMesh?.metadata?.spawn)
          );
        }
        break;
      default:
        break;
    }
  }


  showRegions(value) {
    this.regionsShown = value;
    this.scene?.getNodeById('regions')?.setEnabled(value);
  }

  moveSpawn(spawn) {
    if (!spawn) {
      return;
    }
    const spawnMesh = this.scene?.getMeshById(`zone-spawn-${spawn.id}`);
    if (spawnMesh) {
      spawnMesh.position.x = spawn.y;
      spawnMesh.position.y = spawn.z;
      spawnMesh.position.z = spawn.x;
      spawnMesh.metadata = { spawn };
    }
  }

  async pickRaycastForLoc({
    commitCallback = null,
    stampCallback = null,
    modelName = ''
  }) {
    const meshes = [];
    this.zoneContainer.getChildMeshes().forEach(m => {
      m.isPickable = true;
      meshes.push(m);
    });
    this.pickingRaycast = true;

    let raycastMesh;
    if (modelName) {
      let container;
      try {
        // Create a Blob from the Uint8Array
        const blob = new Blob([this.project.modelFiles[modelName]], { type: 'model/gltf-binary' });
  
        // Create a URL for the blob
        const url = URL.createObjectURL(blob);
  
        container = await SceneLoader.LoadAssetContainerAsync(
          '',
          url,
          this.scene,
          undefined,
          '.glb'
        );
        const instanceContainer = container.instantiateModelsToScene(
          () => 'raycast-sphere',
          undefined,
          { doNotInstantiate: true }
        );
        instanceContainer.animationGroups?.forEach((ag) =>
          this.scene.removeAnimationGroup(ag)
        );
        const meshesToMerge = []; 
        instanceContainer.rootNodes[0].getChildMeshes().forEach((mesh) => {
          if (mesh.getTotalVertices() > 0) {
            const vertexCount = mesh.getTotalVertices();
        
            // Ensure all meshes have positions
            const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
            if (!positions) {
              console.error('Mesh missing position data, skipping...');
              return; // Cannot merge meshes without positions
            }
        
            // Ensure all meshes have normals
            const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
            if (!normals) {
              // If the mesh is missing normals, generate them
              VertexData.ComputeNormals(positions, mesh.getIndices(), normals);
              mesh.setVerticesData(VertexBuffer.NormalKind, normals);
            }
        
            // Ensure all meshes have colors
            let colors = mesh.getVerticesData(VertexBuffer.ColorKind);
            if (!colors) {
              // If the mesh doesn't have colors, create a default color array (white)
              colors = new Float32Array(vertexCount * 4);
              for (let i = 0; i < colors.length; i += 4) {
                colors[i] = 1; // R
                colors[i + 1] = 1; // G
                colors[i + 2] = 1; // B
                colors[i + 3] = 1; // A
              }
              mesh.setVerticesData(VertexBuffer.ColorKind, colors);
            } else {
              // Ensure colors array has the correct length (padding if necessary)
              const requiredLength = vertexCount * 4;
              if (colors.length < requiredLength) {
                const paddedColors = new Float32Array(requiredLength);
                paddedColors.set(colors);
                for (let i = colors.length; i < requiredLength; i += 4) {
                  paddedColors[i] = 1; // R
                  paddedColors[i + 1] = 1; // G
                  paddedColors[i + 2] = 1; // B
                  paddedColors[i + 3] = 1; // A
                }
                mesh.setVerticesData(VertexBuffer.ColorKind, paddedColors);
              }
            }
        
            // Ensure all meshes have UVs
            let uvs = mesh.getVerticesData(VertexBuffer.UVKind);
            if (!uvs) {
              // If the mesh doesn't have UVs, create a default UV array
              uvs = new Float32Array(vertexCount * 2); // Two values per vertex
              for (let i = 0; i < uvs.length; i += 2) {
                uvs[i] = 0; // U
                uvs[i + 1] = 0; // V
              }
              mesh.setVerticesData(VertexBuffer.UVKind, uvs);
            }
        
            meshesToMerge.push(mesh); // Add the mesh to the list for merging
          }
        });
        if (meshesToMerge.length > 0) {
          let mergedMesh;
          try {
            mergedMesh = Mesh.MergeMeshes(
              meshesToMerge,
              true,
              true,
              undefined,
              false,
              true
            );
          } catch (e) {
            console.warn('Error merging mesh', e);
            mergedMesh = instanceContainer.rootNodes[0].clone();
          }
         
          mergedMesh.name = mergedMesh.id = 'raycast-mesh';
          if (mergedMesh) {
            raycastMesh = mergedMesh; // Add the merged mesh to the array of meshes
          }
        }
        instanceContainer.rootNodes[0].dispose();
      } catch (e) {
        console.warn('Error instantiating model', modelName);
        commitCallback?.(null);
        this.pickingRaycast = false;
        return;
      }
    } else {
      raycastMesh = MeshBuilder.CreateSphere(
        'raycast-sphere',
        { diameter: 3, segments: 32 },
        this.scene
      );
      const material = new StandardMaterial('raycast-sphere', this.scene);

      material.emissiveColor = new Color3(1, 1, 0);
      raycastMesh.material = material;
    }
    console.log('Mesh', raycastMesh);
    const pointLight = new PointLight(
      'pointLight',
      new Vector3(0, 10, 0),
      this.scene
    );
    // pointLight.parent = raycastMesh;
    // Set the intensity of the point light
    pointLight.intensity = 500.0;
    pointLight.range = 300;
    pointLight.radius = 50;

    // Optional: Adjust other properties like the light's color
    pointLight.diffuse = new Color3(1, 1, 1); // White light
    pointLight.position = raycastMesh.position;

    let chosenLocation = null;

    const tooltip = document.createElement('div');
    tooltip.className = 'raycast-tooltip';
    document.body.appendChild(tooltip);

    const mouseMove = (e) => {
      // Calculate the pick ray from the camera position and mouse position

      const pickResult = this.scene.pick(
        this.scene.pointerX,
        this.scene.pointerY,
        null,
        false,
        this.CameraController.camera,
        (p0, p1, p2, ray) => {
          const p0p1 = p0.subtract(p1);
          const p2p1 = p2.subtract(p1);
          const normal = Vector3.Cross(p0p1, p2p1);
          return Vector3.Dot(ray.direction, normal) > 0;
        }
      );

      // Check if the ray intersects with the specific mesh
      if (pickResult.hit && meshes.includes(pickResult.pickedMesh)) {
        // Perform actions based on the hit
        const hitPoint = pickResult.pickedPoint;
        raycastMesh.position.set(hitPoint.x, hitPoint.y, hitPoint.z);
        chosenLocation = { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z };

        tooltip.style.left = `${e.pageX - tooltip.clientWidth / 2}px`;
        tooltip.style.top = `${e.pageY + tooltip.clientHeight / 2}px`;
        tooltip.innerHTML = `<p>[T] Commit - ${stampCallback ? ' [E] Stamp - ' : ''}[ESC] Cancel</p><p>X: ${hitPoint.z.toFixed(
          2
        )}, Y: ${hitPoint.x.toFixed(2)}, Z: ${(hitPoint.y + 5).toFixed(2)}</p>`;
      }
    };
    const self = this;
    const finish = async (loc, stamp = false) => {
      this.pickingRaycast = false;
      if (stamp) {
        stampCallback?.(loc, raycastMesh);
        return;
      }
      await commitCallback?.(loc, raycastMesh);
      window.removeEventListener('keydown', keyHandler);
      self.canvas.removeEventListener('mousemove', mouseMove);
      meshes.forEach(m => m.isPickable = false);
      raycastMesh.dispose();
      pointLight.dispose();
      document.body.removeChild(tooltip);
    };
    function keyHandler(e) {
      if (e.key === 'Escape') {
        finish(null);
      }

      if (e.key?.toLowerCase() === 't') {
        finish(chosenLocation);
      }

      if (e.key?.toLowerCase() === 'e') {
        finish(chosenLocation, true);
      }
    }
    window.addEventListener('keydown', keyHandler);
    this.canvas.addEventListener('mousemove', mouseMove);
  }

  setFlySpeed(value) {
    this.cameraFlySpeed = value;
    if (!this.CameraController?.camera) {
      return;
    }
    this.CameraController.camera.speed = value;
  }

  setClipPlane(value) {
    if (!this.CameraController?.camera) {
      return;
    }
    this.CameraController.camera.maxZ = value;
    const scaleValue = value / 10000;
    this.skybox.scaling.setAll(scaleValue);
  }

  setGlow(value) {
    if (!this.glowLayer) {
      return;
    }
    this.glowLayer.intensity = value ? 0.7 : 0;
    if (value) {
    } else {
    }
  }
  setSpawnLOD() {}

  async loadModel(project) {
    this.project = project;
    this.zoneMetadata = project.metadata;
    this.name = project.projectName;
    this.metadata = project.metadata;
    GlobalStore.actions.setLoading(true);
    GlobalStore.actions.setLoadingTitle(`Loading ${this.name}`);
    GlobalStore.actions.setLoadingText(`Loading ${this.name} zone`);

    if (!(await this.loadViewerScene())) {
      return;
    }
    if (this.cameraFlySpeed !== undefined && this.CameraController?.camera) {
      this.CameraController.camera.speed = this.cameraFlySpeed;
    }
    // Skybox
    const skybox = MeshBuilder.CreateBox(
      'skyBox',
      { size: 10000.0 },
      this.scene
    );
    this.skybox = skybox;
    const skyboxMaterial = new StandardMaterial('skyBox', this.scene);
    skyboxMaterial.backFaceCulling = false;

    const png_array = [];
    const map = ['px', 'py', 'pz', 'nx', 'ny', 'nz'];
    for (let i = 0; i < 6; i++) {
      png_array.push(`/static/skybox_${map[i]}.jpg`);
    }
    skyboxMaterial.reflectionTexture = new CubeTexture(
      '/',
      this.scene,
      [],
      false,
      png_array,
      undefined,
      undefined,
      undefined,
      undefined,
      '.jpg'
    );
    skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new Color3Gradient(0, 0, 0);
    skyboxMaterial.specularColor = new Color3(0, 0, 0);
    skybox.material = skyboxMaterial;

    const blob = new Blob([project.glb], { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);

    const zone = await SceneLoader.ImportMeshAsync(
      null,
      '',
      url,
      this.scene,
      undefined,
      '.glb'
    );
    this.boundaryContainer = new TransformNode('boundary', this.scene);
    this.zoneContainer = new TransformNode('zone', this.scene);
    zone.meshes.forEach((m) => {
      if (m.material?.metadata?.gltf?.extras?.boundary) {
        m.parent = this.boundaryContainer;
      } else {
        m.parent = this.zoneContainer;
      }
    });


    const metadata = project.metadata;
    if (metadata) {
      const meshes = [];
      this.objectContainer = new TransformNode('objects', this.scene);
      this.regionContainer = new TransformNode('regions', this.scene);
      this.lightContainer = new TransformNode('lights', this.scene);
      this.soundContainer = new TransformNode('sounds', this.scene);
      // this.objectContainer.setEnabled(false);
      this.regionContainer.setEnabled(false);
      this.lightContainer.setEnabled(false);
      this.soundContainer.setEnabled(false);
      for (const [key, value] of Object.entries(metadata.objects)) {
        meshes.push(...(await this.instantiateObjects(key, value)));
      }

      for (const mesh of meshes.flat()) {
        mesh.parent = this.objectContainer;
      }
      this.instantiateRegions(metadata.regions);
      this.instantiateSounds(metadata.sounds);
      this.instantiateLights(metadata.lights);
    }

    this.loadCallbacks.forEach((l) => l());
    this.zoneLoaded = true;


    GlobalStore.actions.setLoading(false);
  }

  instantiateRegions(regions) {
    let idx = 0;
    for (const region of regions) {
      const minVertex = new Vector3(
        region.minVertex[0],
        region.minVertex[1],
        region.minVertex[2]
      );
      const maxVertex = new Vector3(
        region.maxVertex[0],
        region.maxVertex[1],
        region.maxVertex[2]
      );

      // Calculate the dimensions of the box
      const width = maxVertex.x - minVertex.x;
      const height = maxVertex.y - minVertex.y;
      const depth = maxVertex.z - minVertex.z;

      // Create the box mesh
      const box = MeshBuilder.CreateBox(
        'box',
        {
          width : width,
          height: height,
          depth : depth,
        },
        this.scene
      );

      box.metadata = region.region;
      box.name = `Region-${idx++}`;
      // Set the position of the box to the center
      box.position = new Vector3(
        region.center[0],
        region.center[1],
        region.center[2]
      );
      this.glowLayer.addIncludedOnlyMesh(box);
      box.material = this.regionMaterial;
      box.parent = this.regionContainer;
      box.forceRenderingWhenOccluded = true;
      box.occlusionType = AbstractMesh.OCCLUSION_TYPE_OPTIMISTIC;
      box.isPickable = true;
      box.metadata = {
        emissiveColor: new Color3(0, 0.5, 1),
      };
    }
  
  }

  toggleOpen(name) {
    if (!this.scene) {
      return;
    }
    for (const node of [this.lightContainer, this.soundContainer, this.regionContainer]) {
      if (node.name !== name) {
        node.setEnabled(false);
      } else {
        node.setEnabled(true);
      }
    }
  }

  renderLoop() {
    if (!this.lightContainer.isEnabled()) {
      
    }
  }

  instantiateLights(lights) {
    let idx = 0;
    for (const light of lights) {
      const size = 3;
      // Create the box mesh
      const box = MeshBuilder.CreateBox(
        'box',
        {
          width : size,
          height: size,
          depth : size,
        },
        this.scene
      );

      box.name = `Light-${idx++}`;
      // Set the position of the box to the center
      box.position = new Vector3(
        light.x,
        light.y,
        light.z
      );
      this.glowLayer.addIncludedOnlyMesh(box);

      const pointLight = new PointLight(`light_${idx}`, box.position, this.scene);
      pointLight.diffuse = new Color3(light.r, light.g, light.b);
      pointLight.intensity = 1.2;
      pointLight.radius = light.radius;
      pointLight.intensityMode = Light.INTENSITYMODE_LUMINANCE;
      pointLight.falloffType = Light.FALLOFF_GLTF;
      pointLight.specular.set(0, 0, 0);
      pointLight.setEnabled(false);
      pointLight.zoneLight = true;
      this.lights.push(pointLight);
      box.light = pointLight;
      pointLight.parent = this.lightContainer;
      // this.scene.selectionOctree.addMesh(box);

      box.material = this.regionMaterial;
      box.parent = this.lightContainer;
      box.forceRenderingWhenOccluded = true;
      box.occlusionType = AbstractMesh.OCCLUSION_TYPE_OPTIMISTIC;
      box.isPickable = true;
      box.metadata = {
        emissiveColor: new Color3(1, 0.5, 0),
      };
    }
  }

  instantiateSounds(sounds) {
    let idx = 0;
    for (const sound of sounds) {
      // Calculate the dimensions of the box
      const width = 3;
      const height = 3;
      const depth = 3;

      // Create the box mesh
      const box = MeshBuilder.CreateBox(
        'box',
        {
          width : width,
          height: height,
          depth : depth,
        },
        this.scene
      );

      box.name = `Sound-${idx++}`;
      // Set the position of the box to the center
      box.position = new Vector3(
        sound.x,
        sound.z,
        sound.y
      );
      this.glowLayer.addIncludedOnlyMesh(box);
      box.material = this.regionMaterial;
      box.parent = this.soundContainer;
      box.forceRenderingWhenOccluded = true;
      box.occlusionType = AbstractMesh.OCCLUSION_TYPE_OPTIMISTIC;
      box.isPickable = true;
      box.metadata = {
        emissiveColor: new Color3(1, 0.5, 1),
      };
    }
  }

  async instantiateObjects(modelName, model) {
    let container;


    try {
      // Create a Blob from the Uint8Array
      const blob = new Blob([this.project.modelFiles[modelName]], { type: 'model/gltf-binary' });

      // Create a URL for the blob
      const url = URL.createObjectURL(blob);

      container = await SceneLoader.LoadAssetContainerAsync(
        '',
        url,
        this.scene,
        undefined,
        '.glb'
      );
    } catch (e) {
      console.warn('Error instantiating model', modelName);
      return [];
    }

    const meshes = [];
    const rn = [];

    for (const [idx, v] of Object.entries(model)) {
      const meshesToMerge = []; // Array to hold meshes for merging

      const { x, y, z, rotateX, rotateY, rotateZ, scale } = v;
      const instanceContainer = container.instantiateModelsToScene(
        () => `${modelName}_${idx}`,
        undefined,
        { doNotInstantiate: true }
      );
      instanceContainer.animationGroups?.forEach((ag) =>
        this.scene.removeAnimationGroup(ag)
      );

      rn.push(instanceContainer);

      // Collect the meshes for merging
      instanceContainer.rootNodes[0].getChildMeshes().forEach((mesh) => {
        if (mesh.getTotalVertices() > 0) {
          meshesToMerge.push(mesh); // Add the mesh to the list for merging
        }
      });
      // Merge the meshes
      if (meshesToMerge.length > 0) {
        const mergedMesh = Mesh.MergeMeshes(
          meshesToMerge,
          true,
          true,
          undefined,
          false,
          true
        );
        mergedMesh.name = mergedMesh.id = `${modelName}_${idx}`;
        // mergedMesh.addLODLevel(1000, null);
        if (mergedMesh) {
          mergedMesh.position = new Vector3(x, y, z);
          mergedMesh.rotation = new Vector3(
            Tools.ToRadians(rotateX),
            Tools.ToRadians(rotateY),
            Tools.ToRadians(rotateZ)
          );
          mergedMesh.scaling.setAll(scale);
          mergedMesh.parent = this.objectContainer; // Set the parent to the object container
          mergedMesh.checkCollisions = true; // Enable collisions for the merged mesh
          meshes.push(mergedMesh); // Add the merged mesh to the array of meshes
        }
      }
      instanceContainer.rootNodes[0].dispose();
    }
    return meshes;
  }
}

export const zoneBuilderController = new ZoneBuilderController();
window.zone = zoneBuilderController;
