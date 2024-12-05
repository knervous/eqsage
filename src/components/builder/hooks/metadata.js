import _React, { useCallback, useState } from 'react';
import * as msgpack from '@msgpack/msgpack';
import pako from 'pako';
import { gameController } from '../../../viewer/controllers/GameController';
import { writeEQFile } from '../../../lib/util/fileHandler';
import { useAlertContext } from '../../../context/alerts';

export const useProject = () => {
  const [, render] = useState(0);
  const { openAlert } = useAlertContext();

  const forceRender = useCallback(() => render((r) => r + 1), []);

  const updateProject = useCallback(
    (fn) => {
      const newProject = fn(gameController.ZoneBuilderController.project);
      gameController.ZoneBuilderController.project = newProject;
      forceRender();
    },
    [forceRender]
  );

  const updateMetadata = useCallback(
    (fn) => {
      const newMetadata = fn(gameController.ZoneBuilderController.metadata);
      gameController.ZoneBuilderController.metadata = newMetadata;
      forceRender();
    },
    [forceRender]
  );

  const saveProject = useCallback(async () => {
    const encoded = msgpack.encode(
      gameController.ZoneBuilderController.project
    );
    const zipped = pako.deflate(encoded);
    await writeEQFile(
      'projects',
      gameController.ZoneBuilderController.project.projectName,
      zipped
    );
    if (alert) {
      openAlert(
        `Project ${gameController.ZoneBuilderController.project.projectName} successfully saved.`
      );
    }
  }, [openAlert]);

  return {
    project : gameController.ZoneBuilderController?.project,
    metadata: gameController.ZoneBuilderController?.metadata,
    zb      : gameController.ZoneBuilderController,
    name    : gameController.ZoneBuilderController?.project?.projectName.replace(
      '.eqs',
      ''
    ),
    saveProject,
    updateProject,
    updateMetadata,
  };
};
