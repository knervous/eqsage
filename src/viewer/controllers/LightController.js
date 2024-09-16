import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Light } from '@babylonjs/core/Lights/light';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Effect } from '@babylonjs/core/Materials/effect';


import { cameraController } from './CameraController';
import { Vector3 as ThreeVector3 } from 'three';
import { PointOctree } from 'sparse-octree';
import { GameControllerChild } from './GameControllerChild';

const maxLights = 8;

class LightController extends GameControllerChild {
  /**
   * @type {import('@babylonjs/core/Lights').PointLight[]}
   */
  zoneLights = [];
  /**
   * @type {import('@babylonjs/core/Lights').HemisphericLight}
   */
  ambientLight = null;
  /**
   * @type {import('@babylonjs/core/Lights').PointLight}
   */
  playerLight = null;

  /**
   * @type {number[]}
   */
  previousLights = [];

  /**
   * @type {import('sparse-octree').PointOctree}
   */
  octree = null;
  dispose() {
    this.zoneLights.forEach((z) => {
      z.dispose();
    });
    this.previousLights = [];
    this.zoneLights = [];
    this.ambientLight?.dispose();
    this.playerLight?.dispose();
  }

  setAmbientColor(hexString) {
    this.ambientLight.diffuse = Color3.FromHexString(hexString);
    this.ambientLight.groundColor = Color3.FromHexString(hexString);
  }

  setIntensity(intensity) {
    this.ambientLight.intensity = intensity;
  }
  /**
   * @param {import('@babylonjs/core/scene').Scene} scene
   * @param {boolean} fromSerialized
   */
  async loadLights(scene, zoneLights, fromSerialized, aabbTree) {
    this.ambientLight =
      scene.getLightByName('__ambient_light__') ??
      new HemisphericLight('__ambient_light__', new Vector3(0, -0, 0), scene);
    this.playerLight =
      scene.getLightByName('__player_light__') ??
      new PointLight('__player_light__', new Vector3(0, 0, 0), scene);

    // Default intensity is 1. Let's dim the light a small amount
    this.ambientLight.intensity = 1.5;

    // This will be part of time of day
    this.ambientLight.diffuse = Color3.FromHexString('#FF792F');
    this.ambientLight.groundColor = Color3.FromHexString('#E69339');

    this.playerLight.intensity = 200;
    this.playerLight.intensityMode = Light.INTENSITYMODE_LUMINANCE;
    this.playerLight.falloffType = Light.FALLOFF_GLTF;
    this.playerLight.position = cameraController.camera.position;

    scene.materials.forEach((mtl) => {
      mtl.maxSimultaneousLights = maxLights;
    });

    if (!fromSerialized) {
      // Instantiate lights
      for (const [idx, lightData] of Object.entries(zoneLights)) {
        const [x, y, z] = lightData.pos;
        const { r, g, b, radius } = lightData;
        const light = new PointLight(
          `light_${idx}`,
          new Vector3(x, y, z),
          scene
        );
        light.diffuse = new Color3(r, g, b);
        light.intensity = 0.2;
        light.radius = radius;
        light.intensityMode = Light.INTENSITYMODE_LUMINANCE;
        light.falloffType = Light.FALLOFF_GLTF;
        light.specular.set(0, 0, 0);
        light.metadata = {
          zoneLight: true,
        };
        this.zoneLights.push(light);
      }
    } else {
      this.zoneLights = [...scene.lights.filter((l) => l.metadata?.zoneLight)];
    }
    // this.zoneLights.forEach(l => l.doNotSerialize = true);

    const { min, max } = aabbTree;
    this.octree = new PointOctree(
      new ThreeVector3(min.x, min.y, min.z),
      new ThreeVector3(max.x, max.y, max.z)
    );

    this.zoneLights.forEach((light, idx) => {
      light.setEnabled(false);
      if (
        !this.octree.set(
          new ThreeVector3(
            light.position.x,
            light.position.z,
            light.position.y
          ),
          idx
        )
      ) {
        console.log('Did not set light', light);
      }
    });
  }

  updateLights(position) {
    if (this.zoneLights.length >= maxLights) {
      const threePosition = new ThreeVector3(
        position.x,
        position.z,
        position.y
      );
      let points = null;
      let radius = 50;
      while (true) {
        points = this.octree.findPoints(threePosition, radius, true);
        if (points.length >= maxLights) {
          break;
        }
        radius += 20;
      }
      points = points
        .sort((a, b) => a.distance - b.distance)
        .slice(0, maxLights)
        .map((a) => a.data);

      for (const prevIdx of this.previousLights) {
        if (!points.includes(prevIdx)) {
          if (this.zoneLights[prevIdx].isEnabled()) {
            this.zoneLights[prevIdx].setEnabled(false);
          }
        }
      }

      points.forEach((idx) => {
        if (!this.zoneLights[idx].isEnabled()) {
          this.zoneLights[idx].setEnabled(true);
        }
      });

      this.previousLights = points;
    }
  }
}

export const lightController = new LightController();

delete Effect.IncludesShadersStore.lightFragment;
Effect.IncludesShadersStore.lightFragment = `
        #ifdef LIGHT{X}
        #if defined(SHADOWONLY) || defined(LIGHTMAP) && defined(LIGHTMAPEXCLUDED{X}) && defined(LIGHTMAPNOSPECULAR{X})
        #else
        #ifdef PBR
        #ifdef SPOTLIGHT{X}
        preInfo=computePointAndSpotPreLightingInfo(light{X}.vLightData,viewDirectionW,normalW);
        #elif defined(POINTLIGHT{X})
        preInfo=computePointAndSpotPreLightingInfo(light{X}.vLightData,viewDirectionW,normalW);
        #elif defined(HEMILIGHT{X})
        preInfo=computeHemisphericPreLightingInfo(light{X}.vLightData,viewDirectionW,normalW);
        #elif defined(DIRLIGHT{X})
        preInfo=computeDirectionalPreLightingInfo(light{X}.vLightData,viewDirectionW,normalW);
        #endif
        preInfo.NdotV=NdotV;
        #ifdef SPOTLIGHT{X}
        #ifdef LIGHT_FALLOFF_GLTF{X}
        preInfo.attenuation=computeDistanceLightFalloff_GLTF(preInfo.lightDistanceSquared,light{X}.vLightFalloff.y);
        preInfo.attenuation*=computeDirectionalLightFalloff_GLTF(light{X}.vLightDirection.xyz,preInfo.L,light{X}.vLightFalloff.z,light{X}.vLightFalloff.w);
        #elif defined(LIGHT_FALLOFF_PHYSICAL{X})
        preInfo.attenuation=computeDistanceLightFalloff_Physical(preInfo.lightDistanceSquared);
        preInfo.attenuation*=computeDirectionalLightFalloff_Physical(light{X}.vLightDirection.xyz,preInfo.L,light{X}.vLightDirection.w);
        #elif defined(LIGHT_FALLOFF_STANDARD{X})
        preInfo.attenuation=computeDistanceLightFalloff_Standard(preInfo.lightOffset,light{X}.vLightFalloff.x);
        preInfo.attenuation*=computeDirectionalLightFalloff_Standard(light{X}.vLightDirection.xyz,preInfo.L,light{X}.vLightDirection.w,light{X}.vLightData.w);
        #else
        preInfo.attenuation=computeDistanceLightFalloff(preInfo.lightOffset,preInfo.lightDistanceSquared,light{X}.vLightFalloff.x,light{X}.vLightFalloff.y);
        preInfo.attenuation*=computeDirectionalLightFalloff(light{X}.vLightDirection.xyz,preInfo.L,light{X}.vLightDirection.w,light{X}.vLightData.w,light{X}.vLightFalloff.z,light{X}.vLightFalloff.w);
        #endif
        #elif defined(POINTLIGHT{X})
        #ifdef LIGHT_FALLOFF_GLTF{X}
        preInfo.attenuation=computeDistanceLightFalloff_GLTF(preInfo.lightDistanceSquared,light{X}.vLightFalloff.y);
        #elif defined(LIGHT_FALLOFF_PHYSICAL{X})
        preInfo.attenuation=computeDistanceLightFalloff_Physical(preInfo.lightDistanceSquared);
        #elif defined(LIGHT_FALLOFF_STANDARD{X})
        preInfo.attenuation=computeDistanceLightFalloff_Standard(preInfo.lightOffset,light{X}.vLightFalloff.x);
        #else
        preInfo.attenuation=computeDistanceLightFalloff(preInfo.lightOffset,preInfo.lightDistanceSquared,light{X}.vLightFalloff.x,light{X}.vLightFalloff.y);
        #endif
        #else
        preInfo.attenuation=1.0;
        #endif
        #ifdef HEMILIGHT{X}
        preInfo.roughness=roughness;
        #else
        preInfo.roughness=adjustRoughnessFromLightProperties(roughness,light{X}.vLightSpecular.a,preInfo.lightDistance);
        #endif
        #ifdef IRIDESCENCE
        preInfo.iridescenceIntensity=iridescenceIntensity;
        #endif
        #ifdef HEMILIGHT{X}
        info.diffuse=computeHemisphericDiffuseLighting(preInfo,light{X}.vLightDiffuse.rgb,light{X}.vLightGround);
        #elif defined(SS_TRANSLUCENCY)
        info.diffuse=computeDiffuseAndTransmittedLighting(preInfo,light{X}.vLightDiffuse.rgb,subSurfaceOut.transmittance);
        #else
        info.diffuse=computeDiffuseLighting(preInfo,light{X}.vLightDiffuse.rgb);
        if (info.diffuse.x > 2.5) {
            info.diffuse *= 2.5 / info.diffuse.x;
        }
        if (info.diffuse.y > 2.5) {
            info.diffuse *= 2.5 / info.diffuse.y;
        }
        if (info.diffuse.z > 2.5) {
            info.diffuse *= 2.5 / info.diffuse.z;
        }
        #endif
        #ifdef SPECULARTERM
        #ifdef ANISOTROPIC
        info.specular=computeAnisotropicSpecularLighting(preInfo,viewDirectionW,normalW,anisotropicOut.anisotropicTangent,anisotropicOut.anisotropicBitangent,anisotropicOut.anisotropy,clearcoatOut.specularEnvironmentR0,specularEnvironmentR90,AARoughnessFactors.x,light{X}.vLightDiffuse.rgb);
        #else
        info.specular=computeSpecularLighting(preInfo,normalW,clearcoatOut.specularEnvironmentR0,specularEnvironmentR90,AARoughnessFactors.x,light{X}.vLightDiffuse.rgb);
        #endif
        #endif
        #ifdef SHEEN
        #ifdef SHEEN_LINKWITHALBEDO
        preInfo.roughness=sheenOut.sheenIntensity;
        #else
        #ifdef HEMILIGHT{X}
        preInfo.roughness=sheenOut.sheenRoughness;
        #else
        preInfo.roughness=adjustRoughnessFromLightProperties(sheenOut.sheenRoughness,light{X}.vLightSpecular.a,preInfo.lightDistance);
        #endif
        #endif
        info.sheen=computeSheenLighting(preInfo,normalW,sheenOut.sheenColor,specularEnvironmentR90,AARoughnessFactors.x,light{X}.vLightDiffuse.rgb);
        #endif
        #ifdef CLEARCOAT
        #ifdef HEMILIGHT{X}
        preInfo.roughness=clearcoatOut.clearCoatRoughness;
        #else
        preInfo.roughness=adjustRoughnessFromLightProperties(clearcoatOut.clearCoatRoughness,light{X}.vLightSpecular.a,preInfo.lightDistance);
        #endif
        info.clearCoat=computeClearCoatLighting(preInfo,clearcoatOut.clearCoatNormalW,clearcoatOut.clearCoatAARoughnessFactors.x,clearcoatOut.clearCoatIntensity,light{X}.vLightDiffuse.rgb);
        #ifdef CLEARCOAT_TINT
        absorption=computeClearCoatLightingAbsorption(clearcoatOut.clearCoatNdotVRefract,preInfo.L,clearcoatOut.clearCoatNormalW,clearcoatOut.clearCoatColor,clearcoatOut.clearCoatThickness,clearcoatOut.clearCoatIntensity);
        info.diffuse*=absorption;
        #ifdef SPECULARTERM
        info.specular*=absorption;
        #endif
        #endif
        info.diffuse*=info.clearCoat.w;
        #ifdef SPECULARTERM
        info.specular*=info.clearCoat.w;
        #endif
        #ifdef SHEEN
        info.sheen*=info.clearCoat.w;
        #endif
        #endif
        #else
        #ifdef SPOTLIGHT{X}
        info=computeSpotLighting(viewDirectionW,normalW,light{X}.vLightData,light{X}.vLightDirection,light{X}.vLightDiffuse.rgb,light{X}.vLightSpecular.rgb,light{X}.vLightDiffuse.a,glossiness);
        #elif defined(HEMILIGHT{X})
        info=computeHemisphericLighting(viewDirectionW,normalW,light{X}.vLightData,light{X}.vLightDiffuse.rgb,light{X}.vLightSpecular.rgb,light{X}.vLightGround,glossiness);
        #elif defined(POINTLIGHT{X}) || defined(DIRLIGHT{X})
        info=computeLighting(viewDirectionW,normalW,light{X}.vLightData,light{X}.vLightDiffuse.rgb,light{X}.vLightSpecular.rgb,light{X}.vLightDiffuse.a,glossiness);
        #endif
        #endif
        #ifdef PROJECTEDLIGHTTEXTURE{X}
        info.diffuse*=computeProjectionTextureDiffuseLighting(projectionLightSampler{X},textureProjectionMatrix{X});
        #endif
        #endif
        #ifdef SHADOW{X}
        #ifdef SHADOWCSM{X}
        for (int i=0; i<SHADOWCSMNUM_CASCADES{X}; i++)
        {
        #ifdef SHADOWCSM_RIGHTHANDED{X}
        diff{X}=viewFrustumZ{X}[i]+vPositionFromCamera{X}.z;
        #else
        diff{X}=viewFrustumZ{X}[i]-vPositionFromCamera{X}.z;
        #endif
        if (diff{X}>=0.) {
        index{X}=i;
        break;
        }
        }
        #ifdef SHADOWCSMUSESHADOWMAXZ{X}
        if (index{X}>=0)
        #endif
        {
        #if defined(SHADOWPCF{X})
        #if defined(SHADOWLOWQUALITY{X})
        shadow=computeShadowWithCSMPCF1(float(index{X}),vPositionFromLight{X}[index{X}],vDepthMetric{X}[index{X}],shadowSampler{X},light{X}.shadowsInfo.x,light{X}.shadowsInfo.w);
        #elif defined(SHADOWMEDIUMQUALITY{X})
        shadow=computeShadowWithCSMPCF3(float(index{X}),vPositionFromLight{X}[index{X}],vDepthMetric{X}[index{X}],shadowSampler{X},light{X}.shadowsInfo.yz,light{X}.shadowsInfo.x,light{X}.shadowsInfo.w);
        #else
        shadow=computeShadowWithCSMPCF5(float(index{X}),vPositionFromLight{X}[index{X}],vDepthMetric{X}[index{X}],shadowSampler{X},light{X}.shadowsInfo.yz,light{X}.shadowsInfo.x,light{X}.shadowsInfo.w);
        #endif
        #elif defined(SHADOWPCSS{X})
        #if defined(SHADOWLOWQUALITY{X})
        shadow=computeShadowWithCSMPCSS16(float(index{X}),vPositionFromLight{X}[index{X}],vDepthMetric{X}[index{X}],depthSampler{X},shadowSampler{X},light{X}.shadowsInfo.y,light{X}.shadowsInfo.z,light{X}.shadowsInfo.x,light{X}.shadowsInfo.w,lightSizeUVCorrection{X}[index{X}],depthCorrection{X}[index{X}],penumbraDarkness{X});
        #elif defined(SHADOWMEDIUMQUALITY{X})
        shadow=computeShadowWithCSMPCSS32(float(index{X}),vPositionFromLight{X}[index{X}],vDepthMetric{X}[index{X}],depthSampler{X},shadowSampler{X},light{X}.shadowsInfo.y,light{X}.shadowsInfo.z,light{X}.shadowsInfo.x,light{X}.shadowsInfo.w,lightSizeUVCorrection{X}[index{X}],depthCorrection{X}[index{X}],penumbraDarkness{X});
        #else
        shadow=computeShadowWithCSMPCSS64(float(index{X}),vPositionFromLight{X}[index{X}],vDepthMetric{X}[index{X}],depthSampler{X},shadowSampler{X},light{X}.shadowsInfo.y,light{X}.shadowsInfo.z,light{X}.shadowsInfo.x,light{X}.shadowsInfo.w,lightSizeUVCorrection{X}[index{X}],depthCorrection{X}[index{X}],penumbraDarkness{X});
        #endif
        #else
        shadow=computeShadowCSM(float(index{X}),vPositionFromLight{X}[index{X}],vDepthMetric{X}[index{X}],shadowSampler{X},light{X}.shadowsInfo.x,light{X}.shadowsInfo.w);
        #endif
        #ifdef SHADOWCSMDEBUG{X}
        shadowDebug{X}=vec3(shadow)*vCascadeColorsMultiplier{X}[index{X}];
        #endif
        #ifndef SHADOWCSMNOBLEND{X}
        float frustumLength=frustumLengths{X}[index{X}];
        float diffRatio=clamp(diff{X}/frustumLength,0.,1.)*cascadeBlendFactor{X};
        if (index{X}<(SHADOWCSMNUM_CASCADES{X}-1) && diffRatio<1.)
        {
        index{X}+=1;
        float nextShadow=0.;
        #if defined(SHADOWPCF{X})
        #if defined(SHADOWLOWQUALITY{X})
        nextShadow=computeShadowWithCSMPCF1(float(index{X}),vPositionFromLight{X}[index{X}],vDepthMetric{X}[index{X}],shadowSampler{X},light{X}.shadowsInfo.x,light{X}.shadowsInfo.w);
        #elif defined(SHADOWMEDIUMQUALITY{X})
        nextShadow=computeShadowWithCSMPCF3(float(index{X}),vPositionFromLight{X}[index{X}],vDepthMetric{X}[index{X}],shadowSampler{X},light{X}.shadowsInfo.yz,light{X}.shadowsInfo.x,light{X}.shadowsInfo.w);
        #else
        nextShadow=computeShadowWithCSMPCF5(float(index{X}),vPositionFromLight{X}[index{X}],vDepthMetric{X}[index{X}],shadowSampler{X},light{X}.shadowsInfo.yz,light{X}.shadowsInfo.x,light{X}.shadowsInfo.w);
        #endif
        #elif defined(SHADOWPCSS{X})
        #if defined(SHADOWLOWQUALITY{X})
        nextShadow=computeShadowWithCSMPCSS16(float(index{X}),vPositionFromLight{X}[index{X}],vDepthMetric{X}[index{X}],depthSampler{X},shadowSampler{X},light{X}.shadowsInfo.y,light{X}.shadowsInfo.z,light{X}.shadowsInfo.x,light{X}.shadowsInfo.w,lightSizeUVCorrection{X}[index{X}],depthCorrection{X}[index{X}],penumbraDarkness{X});
        #elif defined(SHADOWMEDIUMQUALITY{X})
        nextShadow=computeShadowWithCSMPCSS32(float(index{X}),vPositionFromLight{X}[index{X}],vDepthMetric{X}[index{X}],depthSampler{X},shadowSampler{X},light{X}.shadowsInfo.y,light{X}.shadowsInfo.z,light{X}.shadowsInfo.x,light{X}.shadowsInfo.w,lightSizeUVCorrection{X}[index{X}],depthCorrection{X}[index{X}],penumbraDarkness{X});
        #else
        nextShadow=computeShadowWithCSMPCSS64(float(index{X}),vPositionFromLight{X}[index{X}],vDepthMetric{X}[index{X}],depthSampler{X},shadowSampler{X},light{X}.shadowsInfo.y,light{X}.shadowsInfo.z,light{X}.shadowsInfo.x,light{X}.shadowsInfo.w,lightSizeUVCorrection{X}[index{X}],depthCorrection{X}[index{X}],penumbraDarkness{X});
        #endif
        #else
        nextShadow=computeShadowCSM(float(index{X}),vPositionFromLight{X}[index{X}],vDepthMetric{X}[index{X}],shadowSampler{X},light{X}.shadowsInfo.x,light{X}.shadowsInfo.w);
        #endif
        shadow=mix(nextShadow,shadow,diffRatio);
        #ifdef SHADOWCSMDEBUG{X}
        shadowDebug{X}=mix(vec3(nextShadow)*vCascadeColorsMultiplier{X}[index{X}],shadowDebug{X},diffRatio);
        #endif
        }
        #endif
        }
        #elif defined(SHADOWCLOSEESM{X})
        #if defined(SHADOWCUBE{X})
        shadow=computeShadowWithCloseESMCube(light{X}.vLightData.xyz,shadowSampler{X},light{X}.shadowsInfo.x,light{X}.shadowsInfo.z,light{X}.depthValues);
        #else
        shadow=computeShadowWithCloseESM(vPositionFromLight{X},vDepthMetric{X},shadowSampler{X},light{X}.shadowsInfo.x,light{X}.shadowsInfo.z,light{X}.shadowsInfo.w);
        #endif
        #elif defined(SHADOWESM{X})
        #if defined(SHADOWCUBE{X})
        shadow=computeShadowWithESMCube(light{X}.vLightData.xyz,shadowSampler{X},light{X}.shadowsInfo.x,light{X}.shadowsInfo.z,light{X}.depthValues);
        #else
        shadow=computeShadowWithESM(vPositionFromLight{X},vDepthMetric{X},shadowSampler{X},light{X}.shadowsInfo.x,light{X}.shadowsInfo.z,light{X}.shadowsInfo.w);
        #endif
        #elif defined(SHADOWPOISSON{X})
        #if defined(SHADOWCUBE{X})
        shadow=computeShadowWithPoissonSamplingCube(light{X}.vLightData.xyz,shadowSampler{X},light{X}.shadowsInfo.y,light{X}.shadowsInfo.x,light{X}.depthValues);
        #else
        shadow=computeShadowWithPoissonSampling(vPositionFromLight{X},vDepthMetric{X},shadowSampler{X},light{X}.shadowsInfo.y,light{X}.shadowsInfo.x,light{X}.shadowsInfo.w);
        #endif
        #elif defined(SHADOWPCF{X})
        #if defined(SHADOWLOWQUALITY{X})
        shadow=computeShadowWithPCF1(vPositionFromLight{X},vDepthMetric{X},shadowSampler{X},light{X}.shadowsInfo.x,light{X}.shadowsInfo.w);
        #elif defined(SHADOWMEDIUMQUALITY{X})
        shadow=computeShadowWithPCF3(vPositionFromLight{X},vDepthMetric{X},shadowSampler{X},light{X}.shadowsInfo.yz,light{X}.shadowsInfo.x,light{X}.shadowsInfo.w);
        #else
        shadow=computeShadowWithPCF5(vPositionFromLight{X},vDepthMetric{X},shadowSampler{X},light{X}.shadowsInfo.yz,light{X}.shadowsInfo.x,light{X}.shadowsInfo.w);
        #endif
        #elif defined(SHADOWPCSS{X})
        #if defined(SHADOWLOWQUALITY{X})
        shadow=computeShadowWithPCSS16(vPositionFromLight{X},vDepthMetric{X},depthSampler{X},shadowSampler{X},light{X}.shadowsInfo.y,light{X}.shadowsInfo.z,light{X}.shadowsInfo.x,light{X}.shadowsInfo.w);
        #elif defined(SHADOWMEDIUMQUALITY{X})
        shadow=computeShadowWithPCSS32(vPositionFromLight{X},vDepthMetric{X},depthSampler{X},shadowSampler{X},light{X}.shadowsInfo.y,light{X}.shadowsInfo.z,light{X}.shadowsInfo.x,light{X}.shadowsInfo.w);
        #else
        shadow=computeShadowWithPCSS64(vPositionFromLight{X},vDepthMetric{X},depthSampler{X},shadowSampler{X},light{X}.shadowsInfo.y,light{X}.shadowsInfo.z,light{X}.shadowsInfo.x,light{X}.shadowsInfo.w);
        #endif
        #else
        #if defined(SHADOWCUBE{X})
        shadow=computeShadowCube(light{X}.vLightData.xyz,shadowSampler{X},light{X}.shadowsInfo.x,light{X}.depthValues);
        #else
        shadow=computeShadow(vPositionFromLight{X},vDepthMetric{X},shadowSampler{X},light{X}.shadowsInfo.x,light{X}.shadowsInfo.w);
        #endif
        #endif
        #ifdef SHADOWONLY
        #ifndef SHADOWINUSE
        #define SHADOWINUSE
        #endif
        globalShadow+=shadow;
        shadowLightCount+=1.0;
        #endif
        #else
        shadow=1.;
        #endif
        #ifndef SHADOWONLY
        #ifdef CUSTOMUSERLIGHTING
        diffuseBase+=computeCustomDiffuseLighting(info,diffuseBase,shadow);
        #ifdef SPECULARTERM
        specularBase+=computeCustomSpecularLighting(info,specularBase,shadow);
        #endif
        #elif defined(LIGHTMAP) && defined(LIGHTMAPEXCLUDED{X})
        diffuseBase+=lightmapColor.rgb*shadow;
        #ifdef SPECULARTERM
        #ifndef LIGHTMAPNOSPECULAR{X}
        specularBase+=info.specular*shadow*lightmapColor.rgb;
        #endif
        #endif
        #ifdef CLEARCOAT
        #ifndef LIGHTMAPNOSPECULAR{X}
        clearCoatBase+=info.clearCoat.rgb*shadow*lightmapColor.rgb;
        #endif
        #endif
        #ifdef SHEEN
        #ifndef LIGHTMAPNOSPECULAR{X}
        sheenBase+=info.sheen.rgb*shadow;
        #endif
        #endif
        #else
        #ifdef SHADOWCSMDEBUG{X}
        diffuseBase+=info.diffuse*shadowDebug{X};
        #else
        diffuseBase+=info.diffuse*shadow;
        #endif
        #ifdef SPECULARTERM
        specularBase+=info.specular*shadow;
        #endif
        #ifdef CLEARCOAT
        clearCoatBase+=info.clearCoat.rgb*shadow;
        #endif
        #ifdef SHEEN
        sheenBase+=info.sheen.rgb*shadow;
        #endif
        #endif
        #endif
        #endif
        `;
