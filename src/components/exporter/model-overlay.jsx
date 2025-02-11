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
} from '@mui/material';
import BABYLON from '@bjs';
import { gameController } from '../../viewer/controllers/GameController';
import { getEQDir, getFiles } from '../../lib/util/fileHandler';
import { PCConfig } from './pc/pc-config';
import { useSettingsContext } from '@/context/settings';
import { optionType, pcModels, wearsRobe } from './constants';
import { AnimationBar } from './animation-bar';

import './overlay.scss';
import Draggable from 'react-draggable';

const { PBRMaterial, Texture, Color3 } = BABYLON;

function rgbaNumberToHex(rgbaNumber) {
  const r = (rgbaNumber >> 16) & 0xff;
  const g = (rgbaNumber >> 8) & 0xff;
  const b = rgbaNumber & 0xff;
  const a = (rgbaNumber >> 24) & 0xff;
  return `#${((1 << 8) + r).toString(16).slice(1)}${((1 << 8) + g)
    .toString(16)
    .slice(1)}${((1 << 8) + b).toString(16).slice(1)}${((1 << 8) + a)
      .toString(16)
      .slice(1)}`;
}

export const ModelOverlay = ({ selectedModel, selectedType, itemOptions }) => {
  const [animation, setAnimation] = useState('');
  const [head, setHead] = useState(0);
  const [headCount, setHeadCount] = useState(0);
  const [texture, setTexture] = useState(-1);
  const [textures, setTextures] = useState([]);
  const [currentAnimation, setCurrentAnimation] = useState(null);
  const [babylonModel, setBabylonModel] = useState(null);
  const exportPromise = useRef(Promise.resolve());
  const { config, setOption } = useSettingsContext();
  useEffect(() => {
    (async () => {
      setTexture(-1);
      setHead(0);
      setAnimation('pos');
      const count = 0;
      const doesWearRobe = wearsRobe(selectedModel);

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
  }, [selectedModel]);

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
    (node = gameController.currentScene.getMeshById('model_export')) => {
      if (!node) {
        return;
      }
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
        };
        for (const [key, entry] of Object.entries(prefixes)) {
          prefixes[key] = `${modelName}${entry}`;
        }
        const doSwap = (str, color) => {
          const existing = window.gameController.currentScene.materials
            .flat()
            .find((m) => m.name === str);
          if (existing) {
            node.material.subMaterials[idx] = existing;
          } else {
            const newMat = new PBRMaterial(str);
            newMat.metallic = 0;
            newMat.roughness = 1;
            newMat._albedoTexture = new Texture(
              str,
              window.gameController.currentScene,
              mat._albedoTexture.noMipMap,
              mat._albedoTexture.invertY,
              mat._albedoTexture.samplingMode 
            );
            node.material.subMaterials[idx] = newMat;
          }
          const material = node.material.subMaterials[idx];
          if (color !== undefined) {
            const a = (color >> 24) & 0xFF;
            const r = (color >> 16) & 0xFF;
            const g = (color >> 8) & 0xFF;
            const b = (color) & 0xFF;
            material.albedoColor = new Color3(r / 255, g / 255, b / 255);
            material.alpha = a / 255;
          }
        };
        // Face
        if (mat.name.startsWith(prefixes.Face)) {
          const faceString = `${config.face}`.padStart(2, '0');
          const fullString = `${prefixes.Face}0${faceString}${mat.name.at(-1)}`;
          doSwap(fullString);
        }

        ['Chest', 'Arms', 'Wrists', 'Legs', 'Hands', 'Feet'].forEach((key) => {
          if (mat.name.startsWith(prefixes[key])) {
            const pieceConfig = config.pieces[key];
            if (pieceConfig) {
              const chestString = `${config.pieces[key].texture}`.padStart(
                2,
                '0'
              );
              const fullString = `${prefixes[key]}${chestString}${mat.name.slice(
                mat.name.length - 2
              )}`;
              doSwap(fullString, config.pieces[key].color);
            }
     
          }
        });

        if (wearsRobe(selectedModel)) {
          if (mat.name.startsWith('clk')) {
            const val = config.robe.toString().padStart(2, '0');
            const fullString = `clk${val}${mat.name.slice(
              mat.name.length - 2
            )}`;
            doSwap(fullString);
          }
        }
      }
    },
    [config, selectedModel]
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
          const model = await gameController.SpawnController.addExportModel(
            selectedModel,
            head,
            texture,
            config?.primary,
            config?.secondary,
            !config?.shieldPoint
          );
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
      <Draggable handle="#draggable-dialog-title-opt">
        <Box
          className="ui-dialog model-overlay"
          sx={{ overflow: 'visible' }}
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
            <>
              <FormControl
                size="small"
                sx={{ m: 1, width: 250, margin: '5px auto' }}
              >
                <FormLabel id="head-group">Head</FormLabel>
                <Select
                  aria-labelledby="head-group"
                  name="head-group"
                  value={head}
                  onChange={(e) => setHead(e.target.value)}
                >
                  {Array.from({ length: headCount }).map((_, idx) => (
                    <MenuItem value={idx} label={idx}>
                      Head {idx + 1}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl
                size="small"
                sx={{ m: 1, width: 250, margin: '5px auto' }}
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
            </>
          )}

        </Box>
        
      </Draggable>

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
