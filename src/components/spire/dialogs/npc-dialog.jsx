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

export const NpcDialog = ({ onClose, npcs }) => {
 

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
