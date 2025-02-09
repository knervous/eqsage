import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  FormControl,
  MenuItem,
  Select,
  FormLabel,
} from '@mui/material';

import BABYLON from '@bjs';

import { OverlayDialogs } from './dialogs/dialogs';
import { gameController } from '../../viewer/controllers/GameController';
import { getEQDir, getFiles } from '../../lib/util/fileHandler';
import { PCConfig } from './pc/pc-config';

import './overlay.scss';
import {
  animationDefinitions,
  optionType,
  pcModels,
  wearsRobe,
} from './constants';
import { AnimationBar } from './animation-bar';

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




export const ModelOverlay = ({
  selectedModel,
  selectedType,
  itemOptions,
}) => {
  const [animation, setAnimation] = useState('');
  const [head, setHead] = useState(0);
  const [headCount, setHeadCount] = useState(0);
  const [texture, setTexture] = useState(-1);
  const [textures, setTextures] = useState([]);
  const [currentAnimation, setCurrentAnimation] = useState(null);
  const [config, setConfig] = useState(null);
  const [babylonModel, setBabylonModel] = useState(null);
  const exportPromise = useRef(Promise.resolve());

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

  useEffect(() => {
    (async () => {
      await exportPromise.current;
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
          for (const [idx, mat] of Object.entries(
            model.rootNode.material.subMaterials
          )) {
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
              if (mat.name !== str) {
                const existing = window.gameController.currentScene.materials
                  .flat()
                  .find((m) => m.name === str);
                if (existing) {
                  model.rootNode.material.subMaterials[idx] = existing;
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
                  model.rootNode.material.subMaterials[idx] = newMat;
                }
                const material = model.rootNode.material.subMaterials[idx];
                if (color !== undefined) {
                  const hexColor = rgbaNumberToHex(color);
                  const r = parseInt(hexColor.substring(1, 3), 16) / 255;
                  const g = parseInt(hexColor.substring(3, 5), 16) / 255;
                  const b = parseInt(hexColor.substring(5, 7), 16) / 255;
                  const a = parseInt(hexColor.substring(7, 9), 16) / 255;

                  material.albedoColor = new Color3(r, g, b);
                  material.alpha = a;
                }
              }
            };
            // Face
            if (mat.name.startsWith(prefixes.Face)) {
              const faceString = `${config.face}`.padStart(2, '0');
              const fullString = `${prefixes.Face}0${faceString}${mat.name.at(
                -1
              )}`;
              doSwap(fullString);
            }

            ['Chest', 'Arms', 'Wrists', 'Legs', 'Hands', 'Feet'].forEach(
              (key) => {
                if (mat.name.startsWith(prefixes[key])) {
                  const chestString = `${config.pieces[key].texture}`.padStart(
                    2,
                    '0'
                  );
                  const fullString = `${
                    prefixes[key]
                  }${chestString}${mat.name.slice(mat.name.length - 2)}`;
                  doSwap(fullString, config.pieces[key].color);
                }
              }
            );

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
  }, [
    head,
    selectedModel,
    texture,
    selectedType,
    config,
  ]);

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

  return !selectedModel ? null : 
    <>
      <Box
        onKeyDown={(e) => e.stopPropagation()}
        className="model-overlay"
      >
        {pcModel ? <PCConfig
          itemOptions={itemOptions}
          textures={textures}
          setConfig={setConfig}
          model={selectedModel}
        /> : <>
      
          <FormControl size="small" sx={{ m: 1, width: 250, margin: '5px auto' }}>
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

          <FormControl size="small" sx={{ m: 1, width: 250, margin: '5px auto' }}>
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
        </>}

        <AnimationBar
          animations={animations}
          animation={currentAnimation}
          name={animation}
          setAnimation={setAnimation}
          babylonModel={babylonModel}
        />
      
      </Box>
      <OverlayDialogs />
    </>;
};
