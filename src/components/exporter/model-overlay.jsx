import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Box,
  FormControl,
  MenuItem,
  Select,
  FormLabel,
  DialogTitle,
  Stack,
} from '@mui/material';
import BABYLON from '@bjs';
import { gameController } from '../../viewer/controllers/GameController';
import {
  getEQDir,
  getEQFileExists,
  getFiles,
} from '../../lib/util/fileHandler';
import { PCConfig } from './pc/pc-config';
import { useSettingsContext } from '@/context/settings';
import { optionType, pcModels, wearsRobe } from './constants';
import { AnimationBar } from './animation-bar';

import './overlay.scss';
import Draggable from 'react-draggable';
import { GlobalStore } from '@/state';

const { PBRMaterial, Texture, Color3 } = BABYLON;

export const ModelOverlay = ({
  selectedModel,
  selectedType,
  itemOptions,
  hideProfile = false,
}) => {
  const [animation, setAnimation] = useState('');
  const [head, setHead] = useState(0);
  const [headCount, setHeadCount] = useState(0);
  const [texture, setTexture] = useState(-1);
  const [textures, setTextures] = useState([]);
  const [currentAnimation, setCurrentAnimation] = useState(null);
  const [babylonModel, setBabylonModel] = useState(null);
  const exportPromise = useRef(Promise.resolve());
  const {
    config,
    setOption,
    nameplateColor = '#F0F046FF',
  } = useSettingsContext();
  useEffect(() => {
    (async () => {
      setTexture(-1);
      setHead(0);
      setAnimation('pos');
      const doesWearRobe = wearsRobe(selectedModel);
      const modelDir = await getEQDir('models');
      const baseName = selectedModel.slice(0, 3);
      const headFiles = await getFiles(modelDir, (n) =>
        n.startsWith(`${baseName}he`)
      );
      const count = headFiles.length;
      setHeadCount(count);
      if (doesWearRobe) {
        setTextures([0, 1, 2, 3, 4, 5, 6]);
      } else {
        const textureDir = await getEQDir('textures');
        if (textureDir) {
          const files = await getFiles(
            textureDir,
            (name) => name.startsWith(selectedModel),
            true
          );
          const variations = [];
          for (const f of files) {
            const chestRegex = /ch(\d{2})01/;
            if (chestRegex.test(f)) {
              const [, n] = chestRegex.exec(f);
              variations.push(+n);
            }
          }
          setTextures(variations.sort((a, b) => (a > b ? 1 : -1)));
        }
      }
    })();
  }, [selectedModel, selectedType]);

  useEffect(() => {
    if (!babylonModel) {
      return;
    }
    if (animation) {
      const ag = babylonModel.animationGroups?.find(
        (ag) => ag.name === animation
      );
      if (ag) {
        babylonModel.animationGroups?.forEach((a) => a.stop());
        setCurrentAnimation(ag);
        ag.play(true);
      } else {
        console.warn(`Animation not found ${animation}`);
        setCurrentAnimation(null);
      }
    } else {
      setCurrentAnimation(null);
      console.warn(`Animation not found ${animation}`);
    }
  }, [animation, babylonModel]);

  const applyConfig = useCallback(
    async (node = gameController.currentScene.getMeshById('model_export')) => {
      if (!node) {
        return;
      }

      // Nameplate
      let nameplate = gameController.currentScene.getMeshByName('nameplate');
      if (nameplate) {
        nameplate.dispose();
      }
      if (gameController.currentScene.getTextureByName('temp_texture')) {
        gameController.currentScene.getTextureByName('temp_texture').dispose();
      }
      if (gameController.currentScene.getTextureByName('nameplate_texture')) {
        gameController.currentScene
          .getTextureByName('nameplate_texture')
          .dispose();
      }
      if (gameController.currentScene.getMaterialByName('nameplate_material')) {
        gameController.currentScene
          .getMaterialByName('nameplate_material')
          .dispose();
      }
      const name = config.name ?? '';
      const temp = new BABYLON.DynamicTexture(
        'temp_texture',
        64,
        gameController.currentScene
      );
      const tmpctx = temp.getContext();
      tmpctx.font = '16px Arial';
      const textWidth = tmpctx.measureText(name).width + 20;
      const textureGround = new BABYLON.DynamicTexture(
        'nameplate_texture',
        { width: textWidth, height: 30 },
        gameController.currentScene
      );
      textureGround.drawText(
        name,
        null,
        null,
        '17px Arial',
        nameplateColor,
        'transparent',
        false,
        true
      );
      textureGround.update(false, true);
      const materialGround = new BABYLON.StandardMaterial(
        'nameplate_material',
        gameController.currentScene
      );

      materialGround.diffuseTexture = textureGround;
      materialGround.diffuseTexture.hasAlpha = true;
      materialGround.useAlphaFromDiffuseTexture = true;
      materialGround.emissiveColor = Color3.FromHexString('#fbdc02');
      materialGround.disableLighting = true;
      nameplate = BABYLON.MeshBuilder.CreatePlane(
        'nameplate',
        { width: textWidth / 30, height: 1 },
        gameController.currentScene
      );
      nameplate.parent = node;
      nameplate.billboardMode = BABYLON.ParticleSystem.BILLBOARDMODE_ALL;
      nameplate.material = materialGround;

      node.computeWorldMatrix(true);
      node.refreshBoundingInfo();
      const boundingBox = node.getBoundingInfo().boundingBox;
      const currentHeight =
        boundingBox.maximumWorld.y - boundingBox.minimumWorld.y;
      nameplate.position.y = -currentHeight - 1.5;

      for (const [idx, mat] of Object.entries(node.material.subMaterials)) {
        if (!mat?._albedoTexture || !config) {
          continue;
        }
        const modelName = selectedModel.slice(0, 3);
        const prefixes = {
          Face  : 'he',
          Chest : 'ch',
          Arms  : 'ua',
          Wrists: 'fa',
          Legs  : 'lg',
          Hands : 'hn',
          Feet  : 'ft',
          Helm  : 'he',
        };
        for (const [key, entry] of Object.entries(prefixes)) {
          prefixes[key] = `${modelName}${entry}`;
        }
        const doSwap = async (str, color = '0xFFFFFFFF') => {
          const exists = await getEQFileExists('textures', `${str}.png`);
          if (!exists) {
            console.log('Texture did not exist, skipping', str);
            return;
          }
          node.material.name = str;
          node.material.subMaterials[idx]._albedoTexture = new Texture(
            str,
            window.gameController.currentScene,
            mat._albedoTexture.noMipMap,
            mat._albedoTexture.invertY,
            mat._albedoTexture.samplingMode
          );
          const a = (color >> 24) & 0xff;
          const r = (color >> 16) & 0xff;
          const g = (color >> 8) & 0xff;
          const b = color & 0xff;
          node.material.subMaterials[idx].albedoColor = new Color3(
            r / 255,
            g / 255,
            b / 255
          );
          node.material.subMaterials[idx].alpha = a / 255;
        };
        // Face
        if (mat.name.startsWith(`${prefixes.Face}00`)) {
          const faceString = `${config.face}`.padStart(2, '0');
          const fullString = `${prefixes.Face}0${faceString}${mat.name.at(-1)}`;
          await doSwap(fullString);
        }
        await Promise.all(
          ['Chest', 'Arms', 'Wrists', 'Legs', 'Hands', 'Feet'].map(
            async (key) => {
              if (mat.name.startsWith(prefixes[key])) {
                const pieceConfig = config.pieces[key];
                if (pieceConfig) {
                  const configString = `${config.pieces[key].texture}`.padStart(
                    2,
                    '0'
                  );
                  const fullString = `${
                    prefixes[key]
                  }${configString}${mat.name.slice(mat.name.length - 2)}`;
                  if (key === 'Helm') {
                    console.log('FS', fullString);
                  }
                  await doSwap(fullString, config.pieces[key].color);
                }
              }
            }
          )
        );

        if (wearsRobe(selectedModel)) {
          if (mat.name.startsWith('clk')) {
            const robeTexture = config.pieces.Chest?.texture - 6;
            if (robeTexture >= 4 && robeTexture <= 10) {
              const val = (config.pieces.Chest.texture - 6)
                .toString()
                .padStart(2, '0');
              const fullString = `clk${val}${mat.name.slice(
                mat.name.length - 2
              )}`;
              doSwap(fullString, config.pieces.Chest.color);
            }
          }
        }
      }
    },
    [config, selectedModel, nameplateColor]
  );

  useEffect(() => {
    (async () => {
      await exportPromise.current;
      const needsRender = config.needsRender ?? true;
      if (!needsRender) {
        applyConfig();
        return;
      }
      exportPromise.current = (async () => {
        if (selectedType === optionType.pc || selectedType === optionType.npc) {
          const headModel =
            selectedType === optionType.pc
              ? config?.pieces?.Helm?.texture
              : head;
          const model = await gameController.SpawnController.addExportModel(
            selectedModel,
            headModel,
            texture,
            config?.pieces?.Primary?.model,
            config?.pieces?.Secondary?.model,
            config?.pieces?.Secondary?.shieldPoint,
            selectedType === optionType.npc
          );
          if (!model) {
            console.log('No model from addExportModel');
            GlobalStore.actions.setLoading(false);
            return;
          }
          if (selectedType === optionType.npc) {
            setBabylonModel(model);
            return;
          }
          applyConfig(model.rootNode);
          setBabylonModel(model);
        } else if (selectedType === optionType.object) {
          const model = await gameController.SpawnController.addObject(
            selectedModel
          );
          setBabylonModel(model);
        } else {
          const model = await gameController.SpawnController.addObject(
            selectedModel,
            'items'
          );
          setBabylonModel(model);
        }
      })();
    })();
  }, [head, selectedModel, texture, selectedType, config, applyConfig]);

  const animations = useMemo(() => {
    if (!babylonModel?.animationGroups?.length) {
      return [];
    }
    const ag = babylonModel.animationGroups.slice(
      1,
      babylonModel.animationGroups.length
    );
    return [
      babylonModel.animationGroups[0],
      ...ag.sort((a, b) => (a.name > b.name ? 1 : -1)),
    ];
  }, [babylonModel?.animationGroups]);

  const pcModel = useMemo(
    () => pcModels.includes(selectedModel),
    [selectedModel]
  );

  return !selectedModel ? null : (
    <>
      {[optionType.npc, optionType.pc].includes(selectedType) &&
      !hideProfile ? (
          <Draggable handle="#draggable-dialog-title-opt">
            <Box
              className="ui-dialog model-overlay"
              sx={{
                overflow: 'visible',
                ...(selectedType === optionType.npc
                  ? {
                    height    : '200px !important',
                    width     : '200px',
                    paddingTop: '20px',
                  }
                  : {}),
              }}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <DialogTitle
                className="ui-dialog-title"
                style={{ cursor: 'move' }}
                id="draggable-dialog-title-opt"
              >
                {'Options'}
              </DialogTitle>
              {pcModel ? (
                <PCConfig
                  itemOptions={itemOptions}
                  textures={textures}
                  model={selectedModel}
                  config={config}
                  setOption={setOption}
                />
              ) : (
                <Stack
                  direction="column"
                  justifyContent="center"
                  alignContent="center"
                >
                  <FormControl
                    size="small"
                    sx={{ m: 1, width: 150, margin: '5px auto' }}
                  >
                    <FormLabel id="head-group">Body</FormLabel>
                    <Select
                      aria-labelledby="head-group"
                      name="head-group"
                      value={head}
                      onChange={(e) => setHead(e.target.value)}
                    >
                      {Array.from({ length: headCount }).map((_, idx) => (
                        <MenuItem value={idx} label={idx}>
                        Body {idx + 1}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl
                    size="small"
                    sx={{ m: 1, width: 150, margin: '5px auto' }}
                  >
                    <FormLabel id="head-group">Texture</FormLabel>
                    <Select
                      aria-labelledby="head-group"
                      name="head-group"
                      value={texture}
                      onChange={(e) => setTexture(e.target.value)}
                    >
                      <MenuItem value={-1} label={-1}>
                      Default
                      </MenuItem>
                      {textures.map((idx) => (
                        <MenuItem value={idx} label={idx}>
                        Texture {idx + 1}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              )}
            </Box>
          </Draggable>
        ) : null}

      <AnimationBar
        animations={animations}
        animation={currentAnimation}
        name={animation}
        setAnimation={setAnimation}
        babylonModel={babylonModel}
      />
    </>
  );
};
