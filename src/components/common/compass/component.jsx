import React, { useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import BABYLON from '@bjs';

import { gameController } from '../../../viewer/controllers/GameController';
import compass from './CompassFinalLarge.webp';
import compassDot from './compass-dot.png';

const { Tools } = BABYLON;

const initialOffset = {
  left: 45,
  top : 92,
};

function getCardinalDirection(camera) {
  const forward = camera.getForwardRay().direction;
  const angle = Math.atan2(forward.x, forward.z);
  const degrees = Tools.ToDegrees(angle);

  if (degrees < 0) {
    return (degrees + 360) % 360;
  }

  return degrees % 360;
}

export const Compass = ({ forceOpen = false }) => {
  const [degrees, setDegrees] = useState(0);
  const [open, setOpen] = useState(true);
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 });
  useEffect(() => {
    const interval = setInterval(() => {
      if (document?.querySelector('.nav-bg-open')) {
        setOpen(false);
        return;
      }
      if (!gameController.CameraController?.camera) {
        return;
      }
      setOpen(true);
      const cam = gameController.CameraController.camera;
      const camDegrees = getCardinalDirection(cam);

      window.deg = camDegrees;
      setDegrees(camDegrees);
      const x = cam.position.x.toFixed(1);
      const y = cam.position.z.toFixed(1);
      const z = cam.position.y.toFixed(1);

      setPosition((p) => {
        if (p.x === x && p.y === y && p.z === z) {
          return p;
        }
        return { x, y, z };
      });
    }, 10);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const compassPosition = useMemo(() => {
    const offset = { ...initialOffset };
    const radians = (degrees * Math.PI) / 180;
    const radius = 32;
    // Calculate x and y based on the circle's radius and the angle
    offset.left -= radius * Math.cos(radians);
    // Use a negative sine to adjust for the web's coordinate system
    offset.top += -radius * Math.sin(radians);

    return offset;
  }, [degrees]);
  return !open && !forceOpen ? null : (
    <Box sx={{ position: 'fixed', right: '20px', top: '10px', zIndex: 10 }}>
      <img alt="compass" src={compass} width="100px"></img>
      <img
        alt="compass-pin"
        style={{
          position: 'absolute',
          left    : `${compassPosition.left}px`,
          top     : `${compassPosition.top}px`,
        }}
        src={compassDot}
        width="10px"
      ></img>
      <Stack direction={'column'} sx={{ textAlign: 'left', margin: '0 auto', marginLeft: '25px', marginTop: '5px' }}>
        <Typography sx={{ color: 'white' }}>
        X: {position.y}
        </Typography>
        <Typography sx={{ color: 'white' }}>
        Y: {position.x}
        </Typography>
        <Typography sx={{ color: 'white' }}>
        Z: {position.z}
        </Typography>
      </Stack>

    </Box>
  );
};
