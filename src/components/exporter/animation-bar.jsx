import React, { useEffect, useRef, useState } from 'react';
import { gameController } from '@/viewer/controllers/GameController';
import { NavFooter } from '../common/nav/nav-footer';
import {
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import { animationDefinitions } from './constants';
import { useSettingsContext } from '@/context/settings';

const animationNames = new Proxy(animationDefinitions, {
  get(target, prop, _receiver) {
    if (target[prop]) {
      return `[${prop}] ${target[prop]}`;
    }
    return prop;
  },
});

/**
 *
 * @param {{animation: import('@babylonjs/core').AnimationGroup }} param0
 * @returns
 */
export const AnimationBar = ({
  animation,
  babylonModel,
  animations = [],
  setAnimation,
}) => {
  const [playMs, setPlayMs] = useState(0);
  const { cycleAnimations, rotate, setOption } = useSettingsContext();
  const currentAnimation = useRef(animation);
  useEffect(() => {
    console.log('Running this effect');
    if (babylonModel?.rootNode) {
      const rootNode = babylonModel?.rootNode;
      rootNode.computeWorldMatrix(true);
      rootNode.refreshBoundingInfo();
      const boundingBox = rootNode.getBoundingInfo().boundingBox;
      const currentHeight =
        boundingBox.maximumWorld.y - boundingBox.minimumWorld.y;
      rootNode.position.y = currentHeight;
      if (gameController.SpawnController.doResetCamera) {
        gameController.SpawnController.doResetCamera = false;
        gameController.CameraController.camera.setTarget(
          rootNode.position.clone()
        );
      }
    }

    if (!animation || animation.to === 0) {
      setPlayMs(0);
      return;
    }
    const cb = () => {
      const currentFrame = animation.animatables[0]?.masterFrame ?? 0;
      if (currentFrame !== 0) {
        setPlayMs(Math.round(currentFrame));
      }
    };
    gameController.currentScene.onAfterAnimationsObservable.add(cb);

    return () => {
      gameController.currentScene.onAfterAnimationsObservable.remove(cb);
    };
  }, [animation, babylonModel?.rootNode]);

  useEffect(() => {
    gameController.CameraController.rotate(rotate);
  }, [rotate]);




  useEffect(() => {
    currentAnimation.current?.stop();
    if (!cycleAnimations) {
      currentAnimation.current = null;
      return;
    }
    currentAnimation.current = animations.find(
      (p) => p.name === 'p01' || p.name === 'o01'
    );
    if (!currentAnimation.current) {
      return;
    }
    const combatAnimations = animations.filter(
      (a) =>
        a.name.startsWith('c') && !animationNames[a.name].includes('Swim')
    );
    
    currentAnimation.current.play(true);

    const interval = setInterval(() => {
      if (combatAnimations.length > 0) {
        const nextAnim =
              combatAnimations[
                Math.floor(Math.random() * combatAnimations.length)
              ];
        nextAnim.play();
      } 
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [cycleAnimations, animation, animations]);

  return animation ? (
    <NavFooter height="85px" minWidth="800px" className="animation-playback">
      <Stack sx={{ width: '100%' }} direction="column">
        <Stack direction="row" justifyContent={'space-around'}>
          <Select
            size="small"
            aria-labelledby="animation-group"
            sx={{
              marginBottom: '0px',
              marginTop   : '0px',
              height      : '35px',
              outline     : 'none !important',
              width       : '50%',
            }}
            name="animation-group"
            value={animation.name}
            onChange={(e) => {
              setAnimation(e.target.value);
              setOption('cycleAnimations', false);
            }}
          >
            {animations.map((ag) => (
              <MenuItem value={ag.name} label={ag.name}>
                {animationNames[ag.name]}
              </MenuItem>
            ))}
          </Select>
          <FormControlLabel
            sx={{ margin: '0px 0' }}
            control={
              <Checkbox
                disabled={!animations?.length}
                size="small"
                checked={cycleAnimations}
                onChange={(e) => setOption('cycleAnimations', e.target.checked)}
              />
            }
            label="Randomize"
          />
          <FormControlLabel
            sx={{ margin: '0px 0' }}
            control={
              <Checkbox
                size="small"
                checked={rotate}
                onChange={(e) => setOption('rotate', e.target.checked)}
              />
            }
            label="Rotate"
          />
        </Stack>

        <Stack
          direction="row"
          sx={{ margin: '5px 0px', width: '100%' }}
          alignContent={'center'}
          justifyContent={'space-between'}
        >
          <Slider
            sx={{
              '& .MuiSlider-thumb': {
                transition: 'none',
              },
              '& .MuiSlider-track': {
                transition: 'none',
              },
              '& .MuiSlider-rail': {
                transition: 'none',
              },
              width: 'calc(100% - 10px)',
            }}
            value={playMs}
            min={0}
            marks
            max={Math.round(animation.to)}
            step={1}
            onChange={(e) => {
              setPlayMs(e.target.value);
              animation.pause();
              animation.goToFrame(e.target.value);
              // audioController.setMs(+e.target.value);
            }}
            valueLabelDisplay="auto"
          />
          <Button
            size="small"
            onClick={() => {
              if (animation.isPlaying) {
                animation.pause();
              } else {
                animation.play(true);
              }
            }}
            sx={{
              width     : '20px',
              height    : '35px',
              marginTop : '-5px !important',
              marginLeft: '15px',
            }}
          >
            {animation.isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
          </Button>
        </Stack>
      </Stack>
    </NavFooter>
  ) : null;
};
