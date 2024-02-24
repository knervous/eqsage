import {
  SceneLoader,
  Vector3,
  Tools,
  Texture,
  Scene,
  HemisphericLight,
  MeshBuilder,
  StandardMaterial,
  CubeTexture,
  Color3Gradient,
  Color3,
  Mesh,
  TransformNode,
  GlowLayer,
  DynamicTexture,
  ParticleSystem,
  Color4,
  PointerEventTypes,
  Quaternion,
  Matrix,
  VertexBuffer,
  PointLight,
} from '@babylonjs/core';

import { GameControllerChild } from './GameControllerChild';
import {
  AABBNode,
  buildAABBTree,
  recurseTreeFromKnownNode,
} from '../../lib/s3d/bsp/region-utils';
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
  clickCallbacks = [];

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
    if (!this.engine || !this.canvas || !this.gc.engineInitialized) {
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
            c(
              pointerInfo.pickInfo.pickedMesh?.metadata?.spawn
            )
          );
        }
        break;
      default:
        break;
    }
  }

  showSpawnPath(coords) {
    if (!this.scene) {
      return;
    }
    if (this.scene.getMeshById('spawn-path')) {
      this.scene.getMeshById('spawn-path').dispose();
    }
    if (coords.length === 0) {
      return;
    }
    const path = coords.map((a) => new Vector3(a.y, a.z, a.x));
    const tube = MeshBuilder.CreateTube(
      'tube',
      {
        path,
        radius         : 0.5,
        sideOrientation: Mesh.DOUBLESIDE,
        updatable      : true,
      },
      this.scene
    );
    tube.id = 'spawn-path';
    const tubeMaterial = new StandardMaterial('tubeMaterial', this.scene);
    tubeMaterial.emissiveColor = new Color3(0, 0.5, 1); // A bright color for glowing effect
    tube.material = tubeMaterial;
    this.glowLayer.addIncludedOnlyMesh(tube);


    // Function to create an arrow
    const createDirectionalBox = (name, point, scene) => {
  
      // Create box with initial size, will scale later
      const box = MeshBuilder.CreateBox(name, { height: 2, width: 2, depth: 2 }, scene);
      box.parent = tube;
      box.position = point;
      box.material = tubeMaterial;
      this.glowLayer.addIncludedOnlyMesh(box);

    };
  
    // Place directional boxes along the path with updated scaling
    for (let i = 0; i < path.length - 1; i++) {
      createDirectionalBox(`box${ i}`, path[i], this.scene);
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
        // console.log(
        //   `Hit region: ${JSON.stringify(aabbRegion.data ?? {}, null, 4)}`
        // );
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

  npcLight(spawn) {
    const light = this.scene?.getLightById('spawn-light') ?? new PointLight('spawn-light', this.scene);
    light.intensity = 500.0;
    light.diffuse = new Color3(1, 0.84, 0); // RGB for gold color
    light.range = 300;
    light.radius = 50;

    if (!spawn) {
      if (light) {
        light.dispose();
      }
      return;
    }
    const spawnMesh = this.scene?.getMeshById(`zone-spawn-${spawn.id}`);
    if (spawnMesh) {
      light.position = spawnMesh.position;
    } else {
      if (light) {
        light.dispose();
      }
    }
  }

  pickRaycastForLoc(callback) {
    const zoneMesh = this.scene.getMeshByName('zone');
    if (!zoneMesh) {
      return;
    }

    zoneMesh.isPickable = true;

    // Create node for moving
    const raycastMesh = MeshBuilder.CreateSphere(
      'raycast-sphere',
      { diameter: 3, segments: 32 },
      this.scene
    );
    const pointLight = new PointLight('pointLight', new Vector3(0, 10, 0), this.scene);
    // pointLight.parent = raycastMesh;
    // Set the intensity of the point light
    pointLight.intensity = 500.0;
    pointLight.range = 300;
    pointLight.radius = 50;

    // Optional: Adjust other properties like the light's color
    pointLight.diffuse = new Color3(1, 1, 1); // White light
    pointLight.position = raycastMesh.position;
    const material = new StandardMaterial('raycast-sphere', this.scene);

    material.emissiveColor = new Color3(1, 1, 0);
    raycastMesh.material = material;
    this.glowLayer.addIncludedOnlyMesh(raycastMesh);
    let chosenLocation = null;

    const tooltip = document.createElement('div');
    tooltip.className = 'raycast-tooltip';
    document.body.appendChild(tooltip);

    const mouseMove = (e) => {
      // Calculate the pick ray from the camera position and mouse position

      const pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY, null, false, this.CameraController.camera, (p0, p1, p2, ray) => {
        const p0p1 = p0.subtract(p1);
        const p2p1 = p2.subtract(p1);
        const normal = Vector3.Cross(p0p1, p2p1);
        return Vector3.Dot(ray.direction, normal) > 0;
      });

      // Check if the ray intersects with the specific mesh
      if (pickResult.hit && pickResult.pickedMesh === zoneMesh) {
        // Perform actions based on the hit
        const hitPoint = pickResult.pickedPoint;
        raycastMesh.position.set(hitPoint.x, hitPoint.y + 5, hitPoint.z);
        chosenLocation = { x: hitPoint.x, y: hitPoint.y + 5, z: hitPoint.z };

        tooltip.style.left = `${e.pageX - tooltip.clientWidth / 2 }px`;
        tooltip.style.top = `${e.pageY + tooltip.clientHeight / 2 }px`;
        tooltip.innerHTML = `<p>[T] to commit - [Escape] to cancel</p><p>X: ${hitPoint.z.toFixed(2)}, Y: ${hitPoint.x.toFixed(2)}, Z: ${(hitPoint.y + 5).toFixed(2)}</p>`;
      }
    };
    const self = this;
    function finish(loc) {
      window.removeEventListener('keydown', keyHandler);
      self.canvas.removeEventListener('mousemove', mouseMove);
      zoneMesh.isPickable = false;
      raycastMesh.dispose();
      pointLight.dispose();
      document.body.removeChild(tooltip);
      callback(loc);
    }
    function keyHandler(e) {
      if (e.key === 'Escape') {
        finish(null);
      }

      if (e.key?.toLowerCase() === 't') {
        finish(chosenLocation);
      }
    }
    window.addEventListener('keydown', keyHandler);
    this.canvas.addEventListener('mousemove', mouseMove);

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
    zoneSpawnsNode.getChildren().forEach((c) => c.dispose());
    const material = new StandardMaterial('zone-spawns-material', this.scene);
    const pathMaterial = new StandardMaterial('zone-spawns-path-material', this.scene);
    const missingMaterial = new StandardMaterial(
      'zone-spawns-material-missing',
      this.scene
    );
    material.emissiveColor = new Color3(0.5, 0.5, 1);
    pathMaterial.emissiveColor = new Color3(0.0, 0.0, 1);
    pathMaterial.specularColor = new Color4(0.0, 0.0, 1, 0.5);
    missingMaterial.emissiveColor = new Color3(1, 0, 0);

    const addTextOverMesh = function (mesh, lines, scene, id, idx) {
      if (!lines.length) {
        return;
      }
      setTimeout(() => {
        const temp = new DynamicTexture('DynamicTexture', 64, scene);
        const tmpctx = temp.getContext();
        tmpctx.font = '32px Arial';
        const textWidth = lines.reduce((acc, val) => {
          const newTextWidth = tmpctx.measureText(val).width;
          if (newTextWidth > acc) {
            return newTextWidth;
          }
          return acc;
        }, 0);

        const textLengthLongest = lines.reduce((acc, val) => {
          const newTextLength = val.length;
          if (newTextLength > acc) {
            return newTextLength;
          }
          return acc;
        }, 0);
        temp.dispose();

        const dynamicTexture = new DynamicTexture(
          'DynamicTexture',
          { width: textWidth, height: 100 + lines.length * 65 },
          scene
        );
        const ctx = dynamicTexture.getContext();
        const lineHeight = 40; // Adjust based on your font size
        ctx.font = '32px arial';
        ctx.fillStyle = 'white';
        for (let i = 0; i < lines.length; i++) {
          let txt = lines[i];
          txt = txt.padStart(textLengthLongest, ' ');
          ctx.fillText(txt, 0, lineHeight * (i + 1));
        }
        dynamicTexture.update();

        const plane = MeshBuilder.CreatePlane(
          'textPlane',
          { width: textWidth / 60, height: 2 + lines.length },
          scene
        );
        plane.addLODLevel(300, null);
        plane.isPickable = false;
        plane.position.y += 2;
        plane.billboardMode = ParticleSystem.BILLBOARDMODE_ALL;
        plane.parent = mesh;
        const material = new StandardMaterial(`nameplate_${id}`, scene);
        plane.material = material;
        material.diffuseTexture = dynamicTexture;
        material.diffuseTexture.hasAlpha = true;
        material.useAlphaFromDiffuseTexture = true;
        material.emissiveColor = Color3.White();
      }, idx);
    };

    // Bind this to grab later from index
    this.spawns = spawns;

    // Layout for thin instance buffers for npc's
    const npcMesh = MeshBuilder.CreateSphere(
      'zone-spawn',
      { diameter: 3, segments: 32 },
      this.scene
    );
    npcMesh.setEnabled(false);
    npcMesh.parent = zoneSpawnsNode;
    npcMesh.material = material;

    const npcWithPathMesh = MeshBuilder.CreateSphere(
      'zone-spawn',
      { diameter: 3, segments: 32 },
      this.scene
    );
    npcWithPathMesh.setEnabled(false);
    npcWithPathMesh.parent = zoneSpawnsNode;
    npcWithPathMesh.material = pathMaterial;

    this.glowLayer.addIncludedOnlyMesh(npcMesh);
    this.glowLayer.addIncludedOnlyMesh(npcWithPathMesh);

    for (const [idx, spawn] of Object.entries(spawns)) {
      const hasEntries = Array.isArray(spawn.spawnentries);
      const instance = (spawn.grid ? npcWithPathMesh : npcMesh).createInstance(`zone-spawn-${spawn.id}`);
      instance.position.x = spawn.y;
      instance.position.y = spawn.z;
      instance.position.z = spawn.x;
      instance.metadata = { spawn };
      instance.parent = zoneSpawnsNode;
      if (hasEntries) {
        const lines = [];
        for (const entry of spawn.spawnentries) {
          if (!entry.npc_type) {
            continue;
          }
          lines.push(
            `${entry.npc_type?.name} - Level ${entry.npc_type?.level} - ${entry.chance}% Chance`
          );
        }
        addTextOverMesh(instance, lines, this.scene, spawn.id, idx * 5);
      } else {
        addTextOverMesh(
          instance,
          ['No Associated Spawns'],
          this.scene,
          spawn.id,
          idx * 5
        );
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
    console.log('load model', name);
    if (!await this.loadViewerScene()) {
      return;
    }
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
        mergedMesh.isPickable = false;
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

    this.loadCallbacks.forEach((l) => l());
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
