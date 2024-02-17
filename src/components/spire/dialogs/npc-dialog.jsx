import React, { useEffect, useState } from 'react';
import { CommonDialog } from './common';
import { useMainContext } from '../../main/main';
import { gameController } from '../../../viewer/controllers/GameController';
import { DataGrid } from '@mui/x-data-grid';

const columns = [
  { field: 'id', headerName: 'ID', width: 70 },
  { field: 'name', headerName: 'First name', width: 130 },
  { field: 'lastname', headerName: 'Last name', width: 130 },
  {
    field     : 'level',
    headerName: 'Level',
    type      : 'number',
    width     : 90,
  },
];

export const NpcDialog = ({ onClose }) => {
  const [npcs, setNpcs] = useState([]);
  const [spawns, setSpawns] = useState([]);
  const { selectedZone } = useMainContext();
  useEffect(() => {
    if (!gameController.Spire || !selectedZone) {
      return;
    }
    gameController.Spire.Npcs.getNpcsByZone(selectedZone.short_name, selectedZone.version, {
      relations: [
        'all'
      ],
      uniqueEntries: true,
    }).then(npcs => {
      console.log('npcs', npcs);
      setNpcs(npcs);
    });

    gameController.Spire.Spawn.getByZone(selectedZone.short_name, selectedZone.version, {
      relations: [
        'all'
      ],
      uniqueEntries: true,
    }).then(npcs => {
      console.log('spawns', npcs);
      setSpawns(npcs);
    });


  }, [selectedZone]);

  return (
    <CommonDialog fullWidth onClose={onClose} title={'Spawns'}>
      <DataGrid
        rows={npcs}
        columns={columns}
        initialState={{
          pagination: {
            paginationModel: { page: 0, pageSize: 5 },
          },
        }}
        pageSizeOptions={[5, 10]}
        checkboxSelection
      />
    </CommonDialog>
  );
};
