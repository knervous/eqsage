
import { SceneLoader, Vector3,
  Tools, Texture, Scene, HemisphericLight, PointLight, Light, MeshBuilder, StandardMaterial, CubeTexture, Color3Gradient, Color3, Mesh, TransformNode, GlowLayer, DynamicTexture, CreatePlane, ParticleSystem, Color4, PointerEventTypes, PointerInfo } from '@babylonjs/core';

import { GameControllerChild } from './GameControllerChild';
import { AABBNode, buildAABBTree, recurseTreeFromKnownNode } from '../../lib/s3d/bsp/region-utils';
import { getEQFile } from '../../lib/util/fileHandler';

class ZoneController extends GameControllerChild {
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
  lastPosition = new Vector3(0, 0, 0);
  lastAabbNode = null;
  animationRange = 200;
  objectCullRange = 2000;
  /** @type {RecastJSPlugin} */
  navigationPlugin = null;

  loadCallbacks = [];

  addLoadCallback = cb => {
    this.loadCallbacks.push(cb);
  };
  removeLoadCallback = cb => {
    this.loadCallbacks = this.loadCallbacks.filter(l => l !== cb);
  };
  dispose() {
    if (this.scene) {
      this.scene.onPointerObservable.remove(this.onClick.bind(this));
      this.scene.onBeforeRenderObservable.remove(this.renderHook.bind(this));
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
    if (!this.engine || !this.canvas) {
      return;
    }
    this.scene = new Scene(this.engine);
    this.scene.onPointerDown = this.sceneMouseDown;
    this.scene.onPointerUp = this.sceneMouseUp;
    this.CameraController.createCamera(new Vector3(0, 250, 0));
    this.CameraController.camera.rotation = new Vector3(1.57, 1.548, 0);
    const glowLayer = new GlowLayer('glow', this.scene);
    this.glowLayer = glowLayer;
    glowLayer.intensity = 0.7;
    this.ambientLight = new HemisphericLight(
      '__ambient_light__',
      new Vector3(0, -0, 0),
      this.scene
    );
    this.regionMaterial = new StandardMaterial('region-material', this.scene);

    this.regionMaterial.alpha = 0.3;
    this.regionMaterial.diffuseColor = new Color3(0, 127, 65); // Red color
    this.regionMaterial.emissiveColor = new Color4(0, 127, 65, 0.3); // Red color

    // Default intensity is 1. Let's dim the light a small amount
    this.ambientLight.intensity = 1.5;

    // Click events
    this.scene.onPointerObservable.add(this.onClick.bind(this));
  }

  /**
   * 
   * @param {PointerInfo} pointerInfo 
   */
  onClick(pointerInfo) {
 
    switch (pointerInfo.type) {
      case PointerEventTypes.POINTERDOWN:
        // Check if the mesh under the pointer is the sphere
        if (pointerInfo.pickInfo.hit && ((pointerInfo.pickInfo.pickedMesh?.metadata?.spawnId ?? null) !== null)) {
          console.log('Spawn', pointerInfo.pickInfo.pickedMesh?.metadata?.spawnId);
          // Place your onClick logic here
        }
        break;
      default:
        break;
      
    }
  }
  renderHook() {
    if (window.aabbPerf === undefined) {
      window.aabbPerf = 0;
    }
    if (window.aabbs === undefined) {
      window.aabbs = [];
    }
    this.skybox.position = this.CameraController.camera.position;
    
    const aabbPerf = performance.now();
    const aabbRegion = recurseTreeFromKnownNode(
      this.lastAabbNode || this.aabbTree,
      this.CameraController.camera.globalPosition
    );

    if (aabbRegion) {
      this.lastAabbNode = aabbRegion;
      if (aabbRegion?.data) {
        console.log(
          `Hit region: ${JSON.stringify(aabbRegion.data ?? {}, null, 4)}`
        );
      }
    }
    const timeTaken = performance.now() - aabbPerf;
    window.aabbs.push(timeTaken);
    if (window.aabbs.length > 100) {
      window.aabbs.shift();
    }
    window.aabbAvg =
      window.aabbs.reduce((acc, val) => acc + val, 0) / window.aabbs.length;
    window.aabbPerf += timeTaken;
  }

  showRegions(value) {
    this.regionsShown = value;
    this.scene?.getNodeById('regions')?.setEnabled(value);
  }

  loadZoneSpawns(spawns) {
    if (!this.scene) {
      return;
    }
    let zoneSpawnsNode = this.scene?.getNodeById('zone-spawns');
    if (!zoneSpawnsNode) {
      zoneSpawnsNode = new TransformNode('zone-spawns', this.scene);
    }
    zoneSpawnsNode.setEnabled(true);
    zoneSpawnsNode.id = 'zone-spawns';
    zoneSpawnsNode.getChildren().forEach(c => c.dispose());
    const material = new StandardMaterial('zone-spawns-material', this.scene);
    material.emissiveColor = new Color3(0.5, 0.5, 1);

    const addTextOverMesh = function(mesh, text, scene, offset, id) {
      const temp = new DynamicTexture('DynamicTexture', 64, scene);
      const tmpctx = temp.getContext();
      tmpctx.font = '16px Arial';
      const textWidth = tmpctx.measureText(text).width + 20;
      temp.dispose();

      const dynamicTexture = new DynamicTexture('DynamicTexture', { width: textWidth, height: 80 }, scene);
      dynamicTexture.drawText(text, null, null, 'bold 16px Arial', 'white', 'transparent', true, true);

      const plane = MeshBuilder.CreatePlane('textPlane', { width: textWidth / 30, height: 3 }, scene);
      plane.addLODLevel(500, null);

      // plane.position = mesh.position.clone();
      plane.position.y += 3 + offset; // Adjust this value to control the height of the text above the sphere
      plane.billboardMode = ParticleSystem.BILLBOARDMODE_ALL;
      plane.parent = mesh;
      const material = new StandardMaterial(`nameplate_${id}`, scene);
      plane.material = material;
      material.diffuseTexture = dynamicTexture;
      material.diffuseTexture.hasAlpha = true;
      material.useAlphaFromDiffuseTexture = true;
      material.emissiveColor = Color3.White();// ('#fbdc02');// Color3.FromInts(100, 200, 100);
      return plane;
      // Make the plane always face the camera

    };
    for (const spawn of spawns) {
      const sphere = MeshBuilder.CreateSphere(`zone-spawn-${spawn.id}`, { diameter: 3, segments: 32 }, this.scene);
      sphere.material = material;
      this.glowLayer.addIncludedOnlyMesh(sphere);
      sphere.position.x = spawn.y;
      sphere.position.y = spawn.z;
      sphere.position.z = spawn.x;
      sphere.addLODLevel(1500, null);
      sphere.metadata = { spawnId: spawn.id };
      sphere.parent = zoneSpawnsNode;
      sphere.name = 'npc-sphere';
      let offset = 0;
      const nameplates = [];
      if (Array.isArray(spawn.spawnentries)) {
        for (const entry of spawn.spawnentries) {
          if (!entry.npc_type) {
            continue;
          }
          const text = `${entry.npc_type.name} :: Level ${entry.npc_type.level} :: ${entry.chance}% Chance`;
          nameplates.push(addTextOverMesh(sphere, text, this.scene, offset, spawn.id));
          offset += 1;
        }
      }
    }

  }

  setFlySpeed(value) {
    this.cameraFlySpeed = value;
    if (!this.CameraController?.camera) {
      return;
    }
    this.CameraController.camera.speed = value;
  }

  setGlow(value) {
    if (!this.glowLayer) {
      return;
    }
    this.glowLayer.intensity = value ? 0.7 : 0;
  }

  async loadModel(name) {
    this.loadViewerScene();
    if (this.cameraFlySpeed !== undefined && this.CameraController?.camera) {
      this.CameraController.camera.speed = this.cameraFlySpeed;
    }
    this.scene.onBeforeRenderObservable.add(this.renderHook.bind(this));
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
      png_array.push(
        `https://playground.babylonjs.com/textures/skybox_${map[i]}.jpg`
      );
    }
    skyboxMaterial.reflectionTexture = new CubeTexture(
      'https://playground.babylonjs.com/textures/',
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

    const zone = await SceneLoader.ImportMeshAsync(
      '',
      '/eq/zones/',
      `${name}.glb`,
      this.scene,
      undefined,
      '.glb'
    );
    const zoneMesh = Mesh.MergeMeshes(
      zone.meshes.filter((m) => m.getTotalVertices() > 0),
      true,
      true,
      undefined,
      true,
      true
    );
    zoneMesh.name = 'zone';
    zoneMesh.isPickable = false;
    const metadata = await getEQFile('zones', `${name}.json`, 'json');
    if (metadata) {
      const meshes = [];
      for (const [key, value] of Object.entries(metadata.objects)) {
        meshes.push(...(await this.instantiateObjects(key, value)));
      }
      const mergedMesh = Mesh.MergeMeshes(
        meshes.filter((m) => m?.getTotalVertices() > 0),
        true,
        true,
        undefined,
        true,
        true
      );
      if (mergedMesh) {
        mergedMesh.name = 'static-objects';
      }
      
      const regionNode = new TransformNode('regions', this.scene);
      this.regionNode = regionNode;
      regionNode.setEnabled(!!this.regionsShown);

      let idx = 0;
      console.log('metadata regions', metadata.regions);
      this.aabbTree = buildAABBTree(
        metadata.regions.map(
          (r) => new AABBNode(r.minVertex, r.maxVertex, r.region)
        )
      );
      console.log('AABB tree', this.aabbTree);

      // Build out geometry, will have an option to toggle this on or off in the gui
      for (const region of metadata.regions) {
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
        this.glowLayer.addIncludedOnlyMesh(box);
        
        box.metadata = region.region;
        box.name = `Region-${idx++}`;
        // Set the position of the box to the center
        box.position = new Vector3(
          region.center[0],
          region.center[1],
          region.center[2]
        );

        box.material = this.regionMaterial;
        // box.showBoundingBox = true;
        box.parent = regionNode;
      }
    }
    await this.addTextureAnimations();

    this.loadCallbacks.forEach(l => l());
  }

  async instantiateObjects(modelName, model, forEditing = false) {
    const container = await SceneLoader.LoadAssetContainerAsync(
      '/eq/objects/',
      `${modelName}.glb`,
      this.scene,
      undefined,
      '.glb'
    );
    const mergedMeshes = [];

    const meshes = [];
    const rn = [];
    for (const [idx, v] of Object.entries(model)) {
      const { x, y, z, rotateX, rotateY, rotateZ, scale } = v;
      const instanceContainer = container.instantiateModelsToScene(
        () => `${modelName}_${idx}`,
        undefined,
        { doNotInstantiate: forEditing ? false : true }
      );
      instanceContainer.animationGroups?.forEach((ag) =>
        this.scene.removeAnimationGroup(ag)
      );

      const hasAnimations = instanceContainer.animationGroups.length > 0;
      rn.push(instanceContainer);
      for (const mesh of instanceContainer.rootNodes[0].getChildMeshes()) {
        mesh.position = new Vector3(x, y, z);

        mesh.rotation = new Vector3(
          Tools.ToRadians(rotateX),
          Tools.ToRadians(180) + Tools.ToRadians(-1 * rotateY),
          Tools.ToRadians(rotateZ)
        );

        mesh.checkCollisions = true;
        mesh.scaling.z = mesh.scaling.y = mesh.scaling.x = scale;
        mesh.metadata = {
          animated  : hasAnimations,
          zoneObject: true,
        };
        if (forEditing) {
          mesh.addLODLevel(1000, null);
        }
        mesh.id = `${modelName}_${idx}`;
        if (!hasAnimations) {
          mesh.freezeWorldMatrix();
        }
        if (mesh.getTotalVertices() > 0) {
          meshes.push(mesh);
        }
      }
    }
    if (!forEditing) {
      mergedMeshes.push(
        Mesh.MergeMeshes(meshes, true, true, undefined, true, true)
      );
      rn.forEach((r) => r.dispose());
    }
    return mergedMeshes;
  }

  async addTextureAnimations() {
    const addTextureAnimation = (material, textureAnimation) => {
      const [baseTexture] = material.getActiveTextures();
      return textureAnimation.frames.map((f) => {
        return new Texture(
          f,
          this.scene,
          baseTexture.noMipMap,
          baseTexture.invertY,
          baseTexture.samplingMode
        );
      });
    };

    let animationTimerMap = {};
    const animationTexturesCache = {};

    for (const material of this.scene.materials) {
      if (!material.metadata?.gltf?.extras) {
        continue;
      }

      const textureAnimation = material.metadata?.gltf?.extras;
      if (textureAnimation) {
        let allTextures;
        if (animationTexturesCache[material.id]) {
          allTextures = animationTexturesCache[material.id];
        } else {
          allTextures = await addTextureAnimation(material, textureAnimation);
          animationTexturesCache[material.id] = allTextures;
        }
        animationTimerMap = {
          ...animationTimerMap,
          [textureAnimation.animationDelay]: {
            ...(animationTimerMap[textureAnimation.animationDelay] ?? {}),
            materials: [
              ...(animationTimerMap[textureAnimation.animationDelay]
                ?.materials ?? []),
              {
                frames      : textureAnimation.frames,
                currentFrame: 1,
                allTextures,
                material,
              },
            ],
          },
        };
      }
    }

    for (const [time, value] of Object.entries(animationTimerMap)) {
      const interval = setInterval(() => {
        for (const material of value.materials) {
          material.currentFrame =
            material.currentFrame + 1 > material.frames.length
              ? 1
              : material.currentFrame + 1;
          for (const texture of material.material.getActiveTextures()) {
            if (material.allTextures[material.currentFrame - 1]) {
              texture._texture =
                material.allTextures[material.currentFrame - 1]._texture;
            }
          }
        }
      }, +time * 2);

      for (const material of value.materials) {
        material.material.onDisposeObservable.add(() => {
          clearInterval(interval);
        });
      }
    }
  }

}

export const zoneController = new ZoneController();
window.zone = zoneController;